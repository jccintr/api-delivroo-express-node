import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { createStoreWithToken } from './factories/store.factory.js';
import { createDelivery } from './factories/delivery.factory.js';
import { createRider } from './factories/rider.factory.js';
import Store from '../models/store.js';

// Pequeno helper só pra este arquivo: cria uma entrega já num status final,
// atrelada à loja/token de teste, com createdAt controlável (necessário pros
// testes de filtro por período e de ordenação/paginação).
async function createFinishedDelivery(storeId, { status, createdAt, ...overrides } = {}) {
  return createDelivery({
    store: storeId,
    status,
    ...(createdAt ? { createdAt } : {}),
    ...overrides,
  });
}

describe('GET /api/stores/deliveries/history', () => {
  it('deve retornar 401 quando não autenticado (sem token)', async () => {
    const res = await request(app).get('/api/stores/deliveries/history');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Não autorizado');
  });

  it('deve retornar 401 quando token for inválido', async () => {
    const { token } = await createStoreWithToken({ password: '123456' });

    const res = await request(app)
      .get('/api/stores/deliveries/history')
      .set('Authorization', `Bearer ${token}-invalido`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Não autorizado');
  });

  it('deve retornar 403 quando a conta estiver desativada', async () => {
    const { token, store } = await createStoreWithToken({ password: '123456' });
    await Store.findByIdAndUpdate(store._id, { active: false });

    const res = await request(app)
      .get('/api/stores/deliveries/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Conta desativada.');
  });

  it('deve retornar 403 quando a conta não estiver verificada', async () => {
    const { token, store } = await createStoreWithToken({ password: '123456' });
    await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: null, active: true });

    const res = await request(app)
      .get('/api/stores/deliveries/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Conta ainda não verificada.');
  });

  it('deve retornar 400 quando o status informado for inválido', async () => {
    const { token, store } = await createStoreWithToken({ password: '123456' });
    await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: true });

    const res = await request(app)
      .get('/api/stores/deliveries/history?status=em_andamento')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Dados inválidos');
  });

  it('deve retornar 400 quando page ou limit forem inválidos', async () => {
    const { token, store } = await createStoreWithToken({ password: '123456' });
    await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: true });

    const res = await request(app)
      .get('/api/stores/deliveries/history?page=0&limit=500')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.details.some((d) => d.field === 'page')).toBe(true);
    expect(res.body.details.some((d) => d.field === 'limit')).toBe(true);
  });

  it('deve retornar 400 quando "to" for anterior a "from"', async () => {
    const { token, store } = await createStoreWithToken({ password: '123456' });
    await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: true });

    const res = await request(app)
      .get('/api/stores/deliveries/history?from=2026-02-10&to=2026-02-01')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.details.some((d) => d.message.includes('anterior à data inicial'))).toBe(true);
  });

    it('deve retornar 400 quando "from" tiver formato certo mas for uma data inexistente (ex: 31 de abril)', async () => {
    const { token, store } = await createStoreWithToken({ password: '123456' });
    await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: true });

    const res = await request(app)
      .get('/api/stores/deliveries/history?from=2026-04-31&to=2026-08-24')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.details.some((d) => d.field === 'from')).toBe(true);
  });

  it('deve retornar 400 quando "from" for 30 de fevereiro (mês não tem esse dia)', async () => {
    const { token, store } = await createStoreWithToken({ password: '123456' });
    await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: true });

    const res = await request(app)
      .get('/api/stores/deliveries/history?from=2026-02-30&to=2026-08-24')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.details.some((d) => d.field === 'from')).toBe(true);
  });

  it('deve retornar 400 quando "to" for 29 de fevereiro num ano não bissexto', async () => {
    const { token, store } = await createStoreWithToken({ password: '123456' });
    await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: true });

    const res = await request(app)
      .get('/api/stores/deliveries/history?to=2026-02-29') // 2026 não é bissexto
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.details.some((d) => d.field === 'to')).toBe(true);
  });

  it('deve aceitar 29 de fevereiro num ano bissexto', async () => {
    const { token, store } = await createStoreWithToken({ password: '123456' });
    await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: true });

    const res = await request(app)
      .get('/api/stores/deliveries/history?from=2028-02-29') // 2028 é bissexto
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('deve retornar 400 quando "to" tiver formato certo mas mês inexistente (ex: mês 13)', async () => {
    const { token, store } = await createStoreWithToken({ password: '123456' });
    await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: true });

    const res = await request(app)
      .get('/api/stores/deliveries/history?to=2026-13-01')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.details.some((d) => d.field === 'to')).toBe(true);
  });

  it('deve retornar 200 com lista e paginação vazias quando a loja não tem histórico', async () => {
    const { token, store } = await createStoreWithToken({ password: '123456' });
    await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: true });

    const res = await request(app)
      .get('/api/stores/deliveries/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], page: 1, limit: 20, total: 0, totalPages: 1 });
  });

  it('deve trazer só entregas finalizadas (4, 5 ou 6) da própria loja, nunca em andamento ou de outra loja', async () => {
    const { token, store } = await createStoreWithToken({ password: '123456' });
    await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: true });

    const delivered = await createFinishedDelivery(store._id, { status: 4 });
    const returned = await createFinishedDelivery(store._id, { status: 5 });
    const cancelled = await createFinishedDelivery(store._id, { status: 6 });
    await createFinishedDelivery(store._id, { status: 0 }); // em andamento, não deve aparecer
    await createFinishedDelivery(store._id, { status: 3 }); // em andamento, não deve aparecer
    await createDelivery({ status: 4 }); // de outra loja, não deve aparecer

    const res = await request(app)
      .get('/api/stores/deliveries/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    const ids = res.body.data.map((d) => d._id);
    expect(ids).toEqual(
      expect.arrayContaining([delivered._id.toString(), returned._id.toString(), cancelled._id.toString()]),
    );
  });

  it('filtra por status=delivered', async () => {
    const { token, store } = await createStoreWithToken({ password: '123456' });
    await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: true });

    await createFinishedDelivery(store._id, { status: 4 });
    await createFinishedDelivery(store._id, { status: 5 });
    await createFinishedDelivery(store._id, { status: 6 });

    const res = await request(app)
      .get('/api/stores/deliveries/history?status=delivered')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].status).toBe(4);
  });

  it('filtra por status=returned', async () => {
    const { token, store } = await createStoreWithToken({ password: '123456' });
    await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: true });

    await createFinishedDelivery(store._id, { status: 4 });
    await createFinishedDelivery(store._id, { status: 5 });
    await createFinishedDelivery(store._id, { status: 6 });

    const res = await request(app)
      .get('/api/stores/deliveries/history?status=returned')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].status).toBe(5);
  });

  it('filtra por status=cancelled', async () => {
    const { token, store } = await createStoreWithToken({ password: '123456' });
    await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: true });

    await createFinishedDelivery(store._id, { status: 4 });
    await createFinishedDelivery(store._id, { status: 5 });
    await createFinishedDelivery(store._id, { status: 6 });

    const res = await request(app)
      .get('/api/stores/deliveries/history?status=cancelled')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].status).toBe(6);
  });

  it('filtra por período (from/to) usando createdAt, incluindo o dia final inteiro', async () => {
    const { token, store } = await createStoreWithToken({ password: '123456' });
    await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: true });

    await createFinishedDelivery(store._id, { status: 4, createdAt: new Date('2026-01-10T12:00:00Z') });
    const dentroDoRange = await createFinishedDelivery(store._id, {
      status: 4,
      createdAt: new Date('2026-01-15T23:30:00Z'),
    });
    await createFinishedDelivery(store._id, { status: 4, createdAt: new Date('2026-01-20T12:00:00Z') });

    const res = await request(app)
      .get('/api/stores/deliveries/history?from=2026-01-12&to=2026-01-15')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0]._id).toBe(dentroDoRange._id.toString());
  });

  it('pagina corretamente: total, totalPages e os itens certos por página, ordenados do mais recente pro mais antigo', async () => {
    const { token, store } = await createStoreWithToken({ password: '123456' });
    await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: true });

    const base = new Date('2026-03-01T10:00:00Z');
    const created = [];
    for (let i = 0; i < 5; i += 1) {
      const createdAt = new Date(base.getTime() + i * 60000); // +1min a cada uma
      created.push(await createFinishedDelivery(store._id, { status: 4, createdAt }));
    }
    // created[4] é o mais recente, created[0] o mais antigo

    const page1 = await request(app)
      .get('/api/stores/deliveries/history?page=1&limit=2')
      .set('Authorization', `Bearer ${token}`);

    expect(page1.status).toBe(200);
    expect(page1.body.total).toBe(5);
    expect(page1.body.totalPages).toBe(3);
    expect(page1.body.data.map((d) => d._id)).toEqual([created[4]._id.toString(), created[3]._id.toString()]);

    const page3 = await request(app)
      .get('/api/stores/deliveries/history?page=3&limit=2')
      .set('Authorization', `Bearer ${token}`);

    expect(page3.status).toBe(200);
    expect(page3.body.data.map((d) => d._id)).toEqual([created[0]._id.toString()]);
  });

  it('popula o rider quando a entrega finalizada tinha um entregador atribuído', async () => {
    const { token, store } = await createStoreWithToken({ password: '123456' });
    await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: true });
    const rider = await createRider();

    await createFinishedDelivery(store._id, { status: 4, rider: rider._id });

    const res = await request(app)
      .get('/api/stores/deliveries/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].rider).toHaveProperty('name');
    expect(res.body.data[0].rider).toHaveProperty('vehicle');
  });

  it('usa page=1 e limit=20 como default quando não informados', async () => {
    const { token, store } = await createStoreWithToken({ password: '123456' });
    await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: true });
    await createFinishedDelivery(store._id, { status: 4 });

    const res = await request(app)
      .get('/api/stores/deliveries/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
  });
});