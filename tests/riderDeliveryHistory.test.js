import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { createRiderWithToken, createRider } from './factories/rider.factory.js';
import { createDelivery } from './factories/delivery.factory.js';
import { createStore } from './factories/store.factory.js';
import Rider from '../models/rider.js';

// Deixa o rider elegível (mesmos 3 requisitos de findEligibleRider: ativo,
// e-mail verificado, conta aprovada) — replica o padrão já usado em
// tests/delivery.test.js pros endpoints de ação do rider.
async function approveRider(riderId) {
  await Rider.findByIdAndUpdate(riderId, {
    active: true,
    emailVerifiedAt: new Date(),
    accountApprovedAt: new Date(),
  });
}

// Cria uma entrega já num status final, atrelada ao rider/token de teste,
// com createdAt controlável (necessário pros testes de filtro por período e
// de ordenação/paginação). Sempre cria a própria loja da entrega também,
// pra poder testar o populate de `store` na resposta.
async function createFinishedDelivery(riderId, { status, createdAt, ...overrides } = {}) {
  const store = await createStore();
  return createDelivery({
    store: store._id,
    rider: riderId,
    status,
    ...(createdAt ? { createdAt } : {}),
    ...overrides,
  });
}

describe('GET /api/riders/deliveries/history', () => {
  it('deve retornar 401 quando não autenticado (sem token)', async () => {
    const res = await request(app).get('/api/riders/deliveries/history');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Não autorizado');
  });

  it('deve retornar 401 quando token for inválido', async () => {
    const { token } = await createRiderWithToken({ password: '123456' });

    const res = await request(app)
      .get('/api/riders/deliveries/history')
      .set('Authorization', `Bearer ${token}-invalido`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Não autorizado');
  });

  it('deve retornar 403 quando a conta estiver desativada', async () => {
    const { token, rider } = await createRiderWithToken({ password: '123456' });
    await Rider.findByIdAndUpdate(rider._id, { active: false });

    const res = await request(app)
      .get('/api/riders/deliveries/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Conta desativada.');
  });

  it('deve retornar 403 quando a conta não estiver verificada', async () => {
    const { token, rider } = await createRiderWithToken({ password: '123456' });
    await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: null, active: true });

    const res = await request(app)
      .get('/api/riders/deliveries/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Conta ainda não verificada.');
  });

  it('deve retornar 403 quando a conta ainda não estiver aprovada', async () => {
    const { token, rider } = await createRiderWithToken({ password: '123456' });
    await Rider.findByIdAndUpdate(rider._id, {
      active: true,
      emailVerifiedAt: new Date(),
      accountApprovedAt: null,
    });

    const res = await request(app)
      .get('/api/riders/deliveries/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Conta ainda não aprovada.');
  });

  it('deve retornar 400 quando o status informado for inválido', async () => {
    const { token, rider } = await createRiderWithToken({ password: '123456' });
    await approveRider(rider._id);

    const res = await request(app)
      .get('/api/riders/deliveries/history?status=em_andamento')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Dados inválidos');
  });

  it('deve retornar 400 quando "to" for anterior a "from"', async () => {
    const { token, rider } = await createRiderWithToken({ password: '123456' });
    await approveRider(rider._id);

    const res = await request(app)
      .get('/api/riders/deliveries/history?from=2026-02-10&to=2026-02-01')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.details.some((d) => d.message.includes('anterior à data inicial'))).toBe(true);
  });

  it('deve retornar 200 com lista e paginação vazias quando o rider não tem histórico', async () => {
    const { token, rider } = await createRiderWithToken({ password: '123456' });
    await approveRider(rider._id);

    const res = await request(app)
      .get('/api/riders/deliveries/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], page: 1, limit: 20, total: 0, totalPages: 1 });
  });

  it('deve trazer entregas entregues, devolvidas e canceladas pela loja do próprio rider — nunca em andamento nem de outro rider', async () => {
    const { token, rider } = await createRiderWithToken({ password: '123456' });
    await approveRider(rider._id);

    const delivered = await createFinishedDelivery(rider._id, { status: 4 });
    const returned = await createFinishedDelivery(rider._id, { status: 5 });
    // Cancelada pela loja DEPOIS que este rider já tinha aceitado — o campo
    // rider fica mantido de propósito (ver cancelDeliveryByStore), então
    // deve aparecer aqui.
    const cancelledByStore = await createFinishedDelivery(rider._id, { status: 6 });
    await createFinishedDelivery(rider._id, { status: 1 }); // em andamento, não deve aparecer
    await createFinishedDelivery(rider._id, { status: 3 }); // em andamento, não deve aparecer

    const outroRider = await createRider();
    await createFinishedDelivery(outroRider._id, { status: 4 }); // de outro rider, não deve aparecer

    const res = await request(app)
      .get('/api/riders/deliveries/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    const ids = res.body.data.map((d) => d._id);
    expect(ids).toEqual(
      expect.arrayContaining([
        delivered._id.toString(),
        returned._id.toString(),
        cancelledByStore._id.toString(),
      ]),
    );
  });

  it('não traz entregas que o próprio rider cancelou antes da retirada (elas voltam pro pool com rider: null)', async () => {
    const { token, rider } = await createRiderWithToken({ password: '123456' });
    await approveRider(rider._id);

    // Simula o estado pós-cancelamento pelo rider: status volta pra 0 e
    // rider fica null (ver cancelDeliveryByRider) — não há mais vínculo
    // persistido com este rider, então não deve aparecer no histórico dele.
    await createFinishedDelivery(rider._id, { status: 0, rider: null });

    const res = await request(app)
      .get('/api/riders/deliveries/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  it('filtra por status=delivered', async () => {
    const { token, rider } = await createRiderWithToken({ password: '123456' });
    await approveRider(rider._id);

    await createFinishedDelivery(rider._id, { status: 4 });
    await createFinishedDelivery(rider._id, { status: 5 });
    await createFinishedDelivery(rider._id, { status: 6 });

    const res = await request(app)
      .get('/api/riders/deliveries/history?status=delivered')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].status).toBe(4);
  });

  it('filtra por período (from/to) usando createdAt, ancorado no dia civil de Brasília', async () => {
    const { token, rider } = await createRiderWithToken({ password: '123456' });
    await approveRider(rider._id);

    await createFinishedDelivery(rider._id, { status: 4, createdAt: new Date('2026-01-10T12:00:00Z') });
    const dentroDoRange = await createFinishedDelivery(rider._id, {
      status: 4,
      createdAt: new Date('2026-01-15T23:30:00Z'),
    });
    await createFinishedDelivery(rider._id, { status: 4, createdAt: new Date('2026-01-20T12:00:00Z') });

    const res = await request(app)
      .get('/api/riders/deliveries/history?from=2026-01-12&to=2026-01-15')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0]._id).toBe(dentroDoRange._id.toString());
  });

  it('pagina corretamente: total, totalPages e os itens certos por página, ordenados do mais recente pro mais antigo', async () => {
    const { token, rider } = await createRiderWithToken({ password: '123456' });
    await approveRider(rider._id);

    const base = new Date('2026-03-01T10:00:00Z');
    const created = [];
    for (let i = 0; i < 5; i += 1) {
      const createdAt = new Date(base.getTime() + i * 60000); // +1min a cada uma
      created.push(await createFinishedDelivery(rider._id, { status: 4, createdAt }));
    }
    // created[4] é o mais recente, created[0] o mais antigo

    const page1 = await request(app)
      .get('/api/riders/deliveries/history?page=1&limit=2')
      .set('Authorization', `Bearer ${token}`);

    expect(page1.status).toBe(200);
    expect(page1.body.total).toBe(5);
    expect(page1.body.totalPages).toBe(3);
    expect(page1.body.data.map((d) => d._id)).toEqual([created[4]._id.toString(), created[3]._id.toString()]);

    const page3 = await request(app)
      .get('/api/riders/deliveries/history?page=3&limit=2')
      .set('Authorization', `Bearer ${token}`);

    expect(page3.status).toBe(200);
    expect(page3.body.data.map((d) => d._id)).toEqual([created[0]._id.toString()]);
  });

  it('popula a loja (não o rider) na resposta, já que aqui quem lê é o rider', async () => {
    const { token, rider } = await createRiderWithToken({ password: '123456' });
    await approveRider(rider._id);

    await createFinishedDelivery(rider._id, { status: 4 });

    const res = await request(app)
      .get('/api/riders/deliveries/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].store).toHaveProperty('name');
    expect(res.body.data[0].store).not.toHaveProperty('email'); // populate seleciona só name/avatar/address.district
  });

  it('usa page=1 e limit=20 como default quando não informados', async () => {
    const { token, rider } = await createRiderWithToken({ password: '123456' });
    await approveRider(rider._id);
    await createFinishedDelivery(rider._id, { status: 4 });

    const res = await request(app)
      .get('/api/riders/deliveries/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
  });
});