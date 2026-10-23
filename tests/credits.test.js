import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import Store from '../models/store.js';
import CreditPackage from '../models/creditPackage.js';
import RechargeOrder from '../models/rechargeOrder.js';
import CreditTransaction from '../models/creditTransaction.js';
import Delivery from '../models/delivery.js';
import Rider from '../models/rider.js';
import * as sendEmail from '../utils/sendEmailV2.js';
import * as websocket from '../websocket.js';
import * as googleMaps from '../utils/googleMaps.js';
import { crc16, parsePixPayload } from '../utils/pix.js';
import { createStoreWithToken } from './factories/store.factory.js';
import { createAdminWithToken } from './factories/admin.factory.js';
import { createDelivery, createDeliveryPayload } from './factories/delivery.factory.js';
import { createRiderWithToken } from './factories/rider.factory.js';

vi.mock('../utils/cloudinary.js', async () => {
  const mock = await import('./mocks/cloudinary.js');
  return { default: mock.default };
});

const PIX_ENV = {
  PIX_KEY: 'pix@delivroo.test',
  PIX_RECEIVER_NAME: 'Delivroo Express',
  PIX_RECEIVER_CITY: 'Brazopolis',
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

// Loja já verificada e com e-mail único (a factory usa Date.now(), que pode repetir).
let storeSeq = 0;
const newStore = (overrides = {}) =>
  createStoreWithToken({ email: `loja${(storeSeq += 1)}-${Date.now()}@test.com`, emailVerifiedAt: new Date(), ...overrides });

async function newRider() {
  const created = await createRiderWithToken({ password: '123456' });
  await Rider.findByIdAndUpdate(created.rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
  return created;
}

async function createPackage(overrides = {}) {
  return CreditPackage.create({ name: 'Pacote 20', deliveries: 20, price: 28, ...overrides });
}

describe('Pacotes de entregas pré-pagos (Pix)', () => {
  let emailInformed;
  let emailConfirmed;
  let emailRejected;
  let notifyAdminsSpy;
  let notifyStoreSpy;

  // Os testes de concorrência dependem dos índices únicos parciais; o Mongoose
  // os cria em segundo plano, então esperamos terminar antes do primeiro teste.
  beforeAll(async () => {
    await Promise.all([RechargeOrder.init(), CreditTransaction.init()]);
  });

  beforeEach(() => {
    Object.assign(process.env, PIX_ENV);
    emailInformed = vi.spyOn(sendEmail, 'sendAdminRechargeInformedEmail').mockResolvedValue({});
    emailConfirmed = vi.spyOn(sendEmail, 'sendStoreRechargeConfirmedEmail').mockResolvedValue({});
    emailRejected = vi.spyOn(sendEmail, 'sendStoreRechargeRejectedEmail').mockResolvedValue({});
    notifyAdminsSpy = vi.spyOn(websocket, 'notifyAdmins').mockImplementation(() => {});
    notifyStoreSpy = vi.spyOn(websocket, 'notifyStore').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of Object.keys(PIX_ENV)) delete process.env[key];
  });

  // =====================
  // LOJA — pacotes e saldo
  // =====================
  describe('GET /api/stores/credits/packages', () => {
    it('deve retornar 401 sem token', async () => {
      const res = await request(app).get('/api/stores/credits/packages');
      expect(res.status).toBe(401);
    });

    it('lista só os pacotes habilitados, do menor para o maior, com o preço por entrega', async () => {
      const { token } = await newStore();
      await createPackage({ name: 'Pacote 50', deliveries: 50, price: 65 });
      await createPackage({ name: 'Pacote 10', deliveries: 10, price: 15 });
      await createPackage({ name: 'Escondido', deliveries: 5, price: 9, active: false });

      const res = await request(app).get('/api/stores/credits/packages').set(auth(token));

      expect(res.status).toBe(200);
      expect(res.body.packages.map((p) => p.name)).toEqual(['Pacote 10', 'Pacote 50']);
      expect(res.body.packages[0]).toMatchObject({ deliveries: 10, price: 15, unitPrice: 1.5 });
      expect(res.body.packages[1].unitPrice).toBe(1.3);
    });
  });

  describe('GET /api/stores/credits', () => {
    it('soma grátis + comprados e desconta as entregas em andamento', async () => {
      const { token, store } = await newStore({ freeDeliveriesRemaining: 2, deliveryCredits: 3 });
      await createDelivery({ store: store._id, status: 1 });
      await createDelivery({ store: store._id, status: 4 }); // concluída: não conta como em andamento

      const res = await request(app).get('/api/stores/credits').set(auth(token));

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        free: 2,
        purchased: 3,
        available: 5,
        openDeliveries: 1,
        availableToRequest: 4,
        openOrder: null,
      });
    });
  });

  // =====================
  // LOJA — pedido de recarga
  // =====================
  describe('POST /api/stores/credits/orders', () => {
    it('retorna 400 sem pacote e 404 para pacote desabilitado', async () => {
      const { token } = await newStore();
      const off = await createPackage({ active: false });

      const semPacote = await request(app).post('/api/stores/credits/orders').set(auth(token)).send({});
      expect(semPacote.status).toBe(400);

      const desabilitado = await request(app)
        .post('/api/stores/credits/orders')
        .set(auth(token))
        .send({ packageId: String(off._id) });
      expect(desabilitado.status).toBe(404);
    });

    it('retorna 503 quando o Pix não está configurado no .env', async () => {
      for (const key of Object.keys(PIX_ENV)) delete process.env[key];
      const { token } = await newStore();
      const pkg = await createPackage();

      const res = await request(app)
        .post('/api/stores/credits/orders')
        .set(auth(token))
        .send({ packageId: String(pkg._id) });

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('PIX_NOT_CONFIGURED');
    });

    it('cria o pedido com QR code e Pix copia e cola válidos', async () => {
      const { token, store } = await newStore();
      const pkg = await createPackage();

      const res = await request(app)
        .post('/api/stores/credits/orders')
        .set(auth(token))
        .send({ packageId: String(pkg._id) });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('pending');
      expect(res.body.code).toMatch(/^R[A-Z2-9]{6}$/);
      expect(res.body.package).toMatchObject({ name: 'Pacote 20', deliveries: 20, price: 28 });
      expect(res.body.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);

      const fields = parsePixPayload(res.body.pixPayload);
      expect(fields['54']).toBe('28.00');
      expect(fields['26']).toContain('pix@delivroo.test');
      expect(fields['62']).toContain(res.body.code);
      expect(crc16(res.body.pixPayload.slice(0, -4))).toBe(res.body.pixPayload.slice(-4));

      // criar o pedido não mexe no saldo
      const storeInDb = await Store.findById(store._id);
      expect(storeInDb.deliveryCredits).toBe(100);
    });

    it('guarda uma cópia do pacote: editar o preço depois não altera o pedido', async () => {
      const { token } = await newStore();
      const pkg = await createPackage();
      const created = await request(app)
        .post('/api/stores/credits/orders')
        .set(auth(token))
        .send({ packageId: String(pkg._id) });

      await CreditPackage.findByIdAndUpdate(pkg._id, { price: 99 });
      await CreditPackage.findByIdAndDelete(pkg._id);

      const res = await request(app).get(`/api/stores/credits/orders/${created.body.id}`).set(auth(token));
      expect(res.status).toBe(200);
      expect(res.body.package.price).toBe(28);
    });

    it('retorna 409 se já houver um pedido em aberto', async () => {
      const { token } = await newStore();
      const pkg = await createPackage();
      const first = await request(app)
        .post('/api/stores/credits/orders')
        .set(auth(token))
        .send({ packageId: String(pkg._id) });

      const second = await request(app)
        .post('/api/stores/credits/orders')
        .set(auth(token))
        .send({ packageId: String(pkg._id) });

      expect(second.status).toBe(409);
      expect(second.body.code).toBe('OPEN_ORDER_EXISTS');
      expect(second.body.order.id).toBe(first.body.id);
      expect(await RechargeOrder.countDocuments()).toBe(1);
    });

    it('duas requisições simultâneas criam só um pedido em aberto', async () => {
      const { token } = await newStore();
      const pkg = await createPackage();
      const send = () =>
        request(app).post('/api/stores/credits/orders').set(auth(token)).send({ packageId: String(pkg._id) });

      const results = await Promise.all([send(), send()]);

      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await RechargeOrder.countDocuments({ open: true })).toBe(1);
    });
  });

  describe('POST /api/stores/credits/orders/:id/inform ("Já paguei")', () => {
    async function createOrder(token) {
      const pkg = await createPackage();
      const res = await request(app)
        .post('/api/stores/credits/orders')
        .set(auth(token))
        .send({ packageId: String(pkg._id) });
      return res.body;
    }

    it('marca como informado, avisa o admin por e-mail e em tempo real, e NÃO libera saldo', async () => {
      const { token, store } = await newStore();
      const order = await createOrder(token);

      const res = await request(app)
        .post(`/api/stores/credits/orders/${order.id}/inform`)
        .set(auth(token))
        .field('payerNote', 'Paguei às 14h pelo Nubank');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('informed');
      expect(res.body.payerNote).toBe('Paguei às 14h pelo Nubank');
      expect(emailInformed).toHaveBeenCalledTimes(1);
      expect(emailInformed.mock.calls[0][0].order.code).toBe(order.code);
      expect(notifyAdminsSpy).toHaveBeenCalledTimes(1);
      expect(notifyAdminsSpy.mock.calls[0][0].type).toBe('recharge:informed');

      const storeInDb = await Store.findById(store._id);
      expect(storeInDb.deliveryCredits).toBe(100);
    });

    it('aceita o comprovante (opcional) e guarda o link', async () => {
      const { token } = await newStore();
      const order = await createOrder(token);

      const res = await request(app)
        .post(`/api/stores/credits/orders/${order.id}/inform`)
        .set(auth(token))
        .attach('receipt', Buffer.from('fake-png'), { filename: 'comprovante.png', contentType: 'image/png' });

      expect(res.status).toBe(200);
      expect(res.body.receiptUrl).toMatch(/^https:\/\//);
    });

    it('recusa comprovante com tipo de arquivo inválido', async () => {
      const { token } = await newStore();
      const order = await createOrder(token);

      const res = await request(app)
        .post(`/api/stores/credits/orders/${order.id}/inform`)
        .set(auth(token))
        .attach('receipt', Buffer.from('texto'), { filename: 'x.txt', contentType: 'text/plain' });

      expect(res.status).toBe(400);
      const stillPending = await RechargeOrder.findById(order.id);
      expect(stillPending.status).toBe('pending');
    });

    it('não avisa o admin duas vezes (segundo clique retorna 409)', async () => {
      const { token } = await newStore();
      const order = await createOrder(token);

      await request(app).post(`/api/stores/credits/orders/${order.id}/inform`).set(auth(token));
      const second = await request(app).post(`/api/stores/credits/orders/${order.id}/inform`).set(auth(token));

      expect(second.status).toBe(409);
      expect(emailInformed).toHaveBeenCalledTimes(1);
    });

    it('não deixa uma loja informar pagamento de pedido de outra loja', async () => {
      const { token } = await newStore();
      const order = await createOrder(token);
      const { token: otherToken } = await newStore();

      const res = await request(app).post(`/api/stores/credits/orders/${order.id}/inform`).set(auth(otherToken));

      expect(res.status).toBe(404);
    });

    it('se o e-mail do admin falhar, o "Já paguei" continua valendo (pedido informado)', async () => {
      emailInformed.mockRejectedValue(new Error('SMTP fora do ar'));
      const { token } = await newStore();
      const order = await createOrder(token);

      const res = await request(app).post(`/api/stores/credits/orders/${order.id}/inform`).set(auth(token));

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('informed');
    });
  });

  describe('POST /api/stores/credits/orders/:id/cancel', () => {
    it('cancela um pedido que ainda não foi pago e libera um novo', async () => {
      const { token } = await newStore();
      const pkg = await createPackage();
      const created = await request(app)
        .post('/api/stores/credits/orders')
        .set(auth(token))
        .send({ packageId: String(pkg._id) });

      const res = await request(app).post(`/api/stores/credits/orders/${created.body.id}/cancel`).set(auth(token));
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('cancelled');

      const again = await request(app)
        .post('/api/stores/credits/orders')
        .set(auth(token))
        .send({ packageId: String(pkg._id) });
      expect(again.status).toBe(201);
    });

    it('não cancela um pedido já informado', async () => {
      const { token } = await newStore();
      const pkg = await createPackage();
      const created = await request(app)
        .post('/api/stores/credits/orders')
        .set(auth(token))
        .send({ packageId: String(pkg._id) });
      await request(app).post(`/api/stores/credits/orders/${created.body.id}/inform`).set(auth(token));

      const res = await request(app).post(`/api/stores/credits/orders/${created.body.id}/cancel`).set(auth(token));
      expect(res.status).toBe(409);
    });
  });

  // =====================
  // ADMIN — pacotes
  // =====================
  describe('Admin: pacotes de entregas', () => {
    it('exige autenticação de admin', async () => {
      const { token } = await newStore();
      const res = await request(app).get('/api/admin/credit-packages').set(auth(token));
      expect(res.status).toBe(401);
    });

    it('cria, edita, desabilita e exclui um pacote', async () => {
      const { token } = await createAdminWithToken();

      const created = await request(app)
        .post('/api/admin/credit-packages')
        .set(auth(token))
        .send({ name: 'Pacote 10', deliveries: 10, price: 15 });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ name: 'Pacote 10', deliveries: 10, price: 15, unitPrice: 1.5, active: true });

      const edited = await request(app)
        .patch(`/api/admin/credit-packages/${created.body.id}`)
        .set(auth(token))
        .send({ price: 14.5, active: false });
      expect(edited.status).toBe(200);
      expect(edited.body).toMatchObject({ price: 14.5, active: false });

      const list = await request(app).get('/api/admin/credit-packages').set(auth(token));
      expect(list.body.data).toHaveLength(1); // o admin vê também os desabilitados

      const removed = await request(app).delete(`/api/admin/credit-packages/${created.body.id}`).set(auth(token));
      expect(removed.status).toBe(200);
      expect(await CreditPackage.countDocuments()).toBe(0);

      const again = await request(app).delete(`/api/admin/credit-packages/${created.body.id}`).set(auth(token));
      expect(again.status).toBe(404);
    });

    it('valida os dados do pacote', async () => {
      const { token } = await createAdminWithToken();
      const res = await request(app)
        .post('/api/admin/credit-packages')
        .set(auth(token))
        .send({ name: '', deliveries: 0, price: 1.239 });
      expect(res.status).toBe(400);
    });

    it('excluir um pacote não apaga pedidos que já o usaram', async () => {
      const { token: storeToken } = await newStore();
      const { token: adminToken } = await createAdminWithToken();
      const pkg = await createPackage();
      await request(app)
        .post('/api/stores/credits/orders')
        .set(auth(storeToken))
        .send({ packageId: String(pkg._id) });

      await request(app).delete(`/api/admin/credit-packages/${pkg._id}`).set(auth(adminToken));

      expect(await RechargeOrder.countDocuments()).toBe(1);
    });
  });

  // =====================
  // ADMIN — confirmar / recusar
  // =====================
  describe('Admin: recargas', () => {
    async function informedOrder() {
      const { token: storeToken, store } = await newStore({ deliveryCredits: 0 });
      const { token: adminToken, admin } = await createAdminWithToken();
      const pkg = await createPackage();
      const created = await request(app)
        .post('/api/stores/credits/orders')
        .set(auth(storeToken))
        .send({ packageId: String(pkg._id) });
      await request(app).post(`/api/stores/credits/orders/${created.body.id}/inform`).set(auth(storeToken));
      return { storeToken, store, adminToken, admin, order: created.body };
    }

    it('lista com os informados primeiro e devolve os contadores', async () => {
      const { adminToken } = await informedOrder();

      const res = await request(app).get('/api/admin/recharge-orders?status=open').set(auth(adminToken));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe('informed');
      expect(res.body.data[0].store.name).toBeTruthy();
      expect(res.body.counts).toEqual({ informed: 1, pending: 0 });

      const summary = await request(app).get('/api/admin/recharge-orders/summary').set(auth(adminToken));
      expect(summary.body).toEqual({ informed: 1, pending: 0 });

      const dashboard = await request(app).get('/api/admin/dashboard').set(auth(adminToken));
      expect(dashboard.body.recharges).toEqual({ informed: 1, pending: 0 });
    });

    it('confirmar credita as entregas, registra no extrato e avisa a loja', async () => {
      const { adminToken, admin, store, order } = await informedOrder();

      const res = await request(app).post(`/api/admin/recharge-orders/${order.id}/confirm`).set(auth(adminToken));

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('confirmed');

      const storeInDb = await Store.findById(store._id);
      expect(storeInDb.deliveryCredits).toBe(20);

      const transactions = await CreditTransaction.find({ store: store._id });
      expect(transactions).toHaveLength(1);
      expect(transactions[0]).toMatchObject({ type: 'purchase', delta: 20, balanceAfter: 20 });
      expect(String(transactions[0].admin)).toBe(String(admin._id));

      expect(emailConfirmed).toHaveBeenCalledTimes(1);
      expect(notifyStoreSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: 'credits:updated', reason: 'recharge_confirmed' }),
      );
    });

    it('confirmar duas vezes não credita duas vezes', async () => {
      const { adminToken, store, order } = await informedOrder();

      const first = await request(app).post(`/api/admin/recharge-orders/${order.id}/confirm`).set(auth(adminToken));
      const second = await request(app).post(`/api/admin/recharge-orders/${order.id}/confirm`).set(auth(adminToken));

      expect(first.status).toBe(200);
      expect(second.status).toBe(409);
      expect((await Store.findById(store._id)).deliveryCredits).toBe(20);
      expect(await CreditTransaction.countDocuments({ store: store._id })).toBe(1);
    });

    it('dois cliques simultâneos em confirmar creditam uma única vez', async () => {
      const { adminToken, store, order } = await informedOrder();
      const send = () => request(app).post(`/api/admin/recharge-orders/${order.id}/confirm`).set(auth(adminToken));

      const results = await Promise.all([send(), send()]);

      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect((await Store.findById(store._id)).deliveryCredits).toBe(20);
    });

    it('permite confirmar um pedido que ainda estava "aguardando pagamento"', async () => {
      const { token: storeToken, store } = await newStore({ deliveryCredits: 0 });
      const { token: adminToken } = await createAdminWithToken();
      const pkg = await createPackage();
      const created = await request(app)
        .post('/api/stores/credits/orders')
        .set(auth(storeToken))
        .send({ packageId: String(pkg._id) });

      const res = await request(app).post(`/api/admin/recharge-orders/${created.body.id}/confirm`).set(auth(adminToken));

      expect(res.status).toBe(200);
      expect((await Store.findById(store._id)).deliveryCredits).toBe(20);
    });

    it('recusar exige motivo, não credita e avisa a loja', async () => {
      const { adminToken, store, order } = await informedOrder();

      const semMotivo = await request(app)
        .post(`/api/admin/recharge-orders/${order.id}/reject`)
        .set(auth(adminToken))
        .send({ reason: '' });
      expect(semMotivo.status).toBe(400);

      const res = await request(app)
        .post(`/api/admin/recharge-orders/${order.id}/reject`)
        .set(auth(adminToken))
        .send({ reason: 'Não encontrei o Pix na conta' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'rejected', rejectionReason: 'Não encontrei o Pix na conta' });
      expect((await Store.findById(store._id)).deliveryCredits).toBe(0);
      expect(emailRejected).toHaveBeenCalledTimes(1);

      // depois de recusado, não dá mais para confirmar
      const confirm = await request(app).post(`/api/admin/recharge-orders/${order.id}/confirm`).set(auth(adminToken));
      expect(confirm.status).toBe(409);
    });

    it('depois de resolvido, a loja pode criar um novo pedido', async () => {
      const { adminToken, storeToken, order } = await informedOrder();
      await request(app).post(`/api/admin/recharge-orders/${order.id}/confirm`).set(auth(adminToken));
      const pkg = await createPackage({ name: 'Outro' });

      const res = await request(app)
        .post('/api/stores/credits/orders')
        .set(auth(storeToken))
        .send({ packageId: String(pkg._id) });

      expect(res.status).toBe(201);
    });

    it('a falha no e-mail da loja não desfaz a confirmação', async () => {
      emailConfirmed.mockRejectedValue(new Error('SMTP fora do ar'));
      const { adminToken, store, order } = await informedOrder();

      const res = await request(app).post(`/api/admin/recharge-orders/${order.id}/confirm`).set(auth(adminToken));

      expect(res.status).toBe(200);
      expect((await Store.findById(store._id)).deliveryCredits).toBe(20);
    });
  });

  // =====================
  // ADMIN — ajuste manual
  // =====================
  describe('POST /api/admin/stores/:id/credits', () => {
    it('soma e subtrai créditos com motivo, sem deixar o saldo negativo', async () => {
      const { token } = await createAdminWithToken();
      const { store } = await newStore({ deliveryCredits: 0 });

      const add = await request(app)
        .post(`/api/admin/stores/${store._id}/credits`)
        .set(auth(token))
        .send({ delta: 5, note: 'Cortesia de boas-vindas' });
      expect(add.status).toBe(200);
      expect(add.body.purchased).toBe(5);

      const tooMuch = await request(app)
        .post(`/api/admin/stores/${store._id}/credits`)
        .set(auth(token))
        .send({ delta: -10, note: 'Correção' });
      expect(tooMuch.status).toBe(409);
      expect((await Store.findById(store._id)).deliveryCredits).toBe(5);

      const remove = await request(app)
        .post(`/api/admin/stores/${store._id}/credits`)
        .set(auth(token))
        .send({ delta: -3, note: 'Correção' });
      expect(remove.status).toBe(200);
      expect(remove.body.purchased).toBe(2);

      const extract = await request(app).get(`/api/admin/stores/${store._id}/credits`).set(auth(token));
      expect(extract.body.transactions.map((t) => [t.type, t.delta])).toEqual([
        ['adjustment', -3],
        ['adjustment', 5],
      ]);
    });
  });

  // =====================
  // Bloqueio sem saldo e consumo
  // =====================
  describe('Saldo e criação de entregas', () => {
    it('bloqueia o pedido de entrega quando a loja não tem saldo (402)', async () => {
      const { token } = await newStore({ freeDeliveriesRemaining: 0, deliveryCredits: 0 });

      const res = await request(app).post('/api/stores/deliveries').set(auth(token)).send(createDeliveryPayload());

      expect(res.status).toBe(402);
      expect(res.body.code).toBe('INSUFFICIENT_CREDITS');
      expect(await Delivery.countDocuments()).toBe(0);
    });

    it('bloqueia quando o saldo inteiro já está comprometido com entregas em andamento', async () => {
      const { token, store } = await newStore({ freeDeliveriesRemaining: 0, deliveryCredits: 1 });
      await createDelivery({ store: store._id, status: 0 });

      const res = await request(app).post('/api/stores/deliveries').set(auth(token)).send(createDeliveryPayload());

      expect(res.status).toBe(402);
      expect(res.body.openDeliveries).toBe(1);
    });

    it('permite criar quando há saldo livre (só com entregas grátis, ou só com compradas)', async () => {
      vi.spyOn(googleMaps, 'distanceBetween').mockResolvedValue({ meters: 1500 });

      for (const balance of [{ freeDeliveriesRemaining: 1, deliveryCredits: 0 }, { freeDeliveriesRemaining: 0, deliveryCredits: 1 }]) {
        const { token } = await newStore(balance);
        const res = await request(app).post('/api/stores/deliveries').set(auth(token)).send(createDeliveryPayload());
        expect(res.status).toBe(201);
      }
    });

    it('ao concluir a entrega, gasta primeiro as grátis e depois as compradas, e registra no extrato', async () => {
      const { store } = await newStore({ freeDeliveriesRemaining: 1, deliveryCredits: 2 });
      const { token: riderToken, rider } = await newRider();

      const deliver = async () => {
        const delivery = await createDelivery({ store: store._id, status: 3, rider: rider._id });
        return request(app).post(`/api/riders/deliveries/${delivery._id}/deliver`).set(auth(riderToken));
      };

      const first = await deliver();
      expect(first.status).toBe(200);
      expect(first.body).toMatchObject({ platformFee: 0, platformFeeWaived: true, paidWithCredit: false });
      let storeInDb = await Store.findById(store._id);
      expect([storeInDb.freeDeliveriesRemaining, storeInDb.deliveryCredits]).toEqual([0, 2]);

      const second = await deliver();
      expect(second.body).toMatchObject({ platformFee: 1.5, platformFeeWaived: false, paidWithCredit: true });
      storeInDb = await Store.findById(store._id);
      expect(storeInDb.deliveryCredits).toBe(1);

      const transactions = await CreditTransaction.find({ store: store._id, type: 'delivery' });
      expect(transactions).toHaveLength(1);
      expect(transactions[0]).toMatchObject({ delta: -1, balanceAfter: 1 });
    });

    it('sem nenhum saldo na conclusão (entregas abertas ao mesmo tempo), a taxa fica em aberto e o saldo não fica negativo', async () => {
      const { store } = await newStore({ freeDeliveriesRemaining: 0, deliveryCredits: 0 });
      const { token: riderToken, rider } = await newRider();
      const delivery = await createDelivery({ store: store._id, status: 3, rider: rider._id });

      const res = await request(app).post(`/api/riders/deliveries/${delivery._id}/deliver`).set(auth(riderToken));

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ platformFee: 1.5, platformFeeWaived: false, paidWithCredit: false });
      expect((await Store.findById(store._id)).deliveryCredits).toBe(0);
    });
  });
});
