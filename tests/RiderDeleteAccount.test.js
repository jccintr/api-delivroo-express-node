import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import Rider from '../models/rider.js';
import Delivery from '../models/delivery.js';
import cloudinary from '../utils/cloudinary.js';
import { createRider, createRiderWithToken } from './factories/rider.factory.js';
import { createDelivery } from './factories/delivery.factory.js';

// Mesmo mock de Cloudinary usado nos testes de upload de avatar/documento
// (agora com `uploader.destroy`).
vi.mock('../utils/cloudinary.js', async () => {
  const mock = await import('./mocks/cloudinary.js');
  return { default: mock.default };
});

const DELETE_URL = '/api/riders/delete-account';

describe('POST /api/riders/delete-account', () => {
  beforeEach(() => {
    cloudinary.uploader.destroy.mockClear();
  });

  // =====================
  // Sucesso
  // =====================
  it('deve excluir a conta com e-mail e senha corretos', async () => {
    const rider = await createRider({ email: 'excluir@test.com', password: '123456' });

    const res = await request(app).post(DELETE_URL).send({ email: 'excluir@test.com', password: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Conta excluída com sucesso.');
    expect(await Rider.findById(rider._id)).toBeNull();
  });

  it('não deve exigir token (JWT): a página web pública não tem sessão', async () => {
    await createRider({ email: 'semtoken@test.com', password: '123456' });

    const res = await request(app).post(DELETE_URL).send({ email: 'semtoken@test.com', password: '123456' });

    expect(res.status).toBe(200);
  });

  it('deve permitir excluir uma conta desativada', async () => {
    const rider = await createRider({ email: 'inativo@test.com', password: '123456', active: false });

    const res = await request(app).post(DELETE_URL).send({ email: 'inativo@test.com', password: '123456' });

    expect(res.status).toBe(200);
    expect(await Rider.findById(rider._id)).toBeNull();
  });

  it('deve impedir o login depois da exclusão e liberar o e-mail para um novo cadastro', async () => {
    await createRider({ email: 'reuso@test.com', password: '123456' });
    await request(app).post(DELETE_URL).send({ email: 'reuso@test.com', password: '123456' });

    const login = await request(app).post('/api/riders/login').send({ email: 'reuso@test.com', password: '123456' });
    expect(login.status).toBe(400);
    expect(login.body.error).toBe('Email ou senha inválidos.');

    const again = await createRider({ email: 'reuso@test.com', password: '654321' });
    expect(again._id).toBeDefined();
  });

  it('deve invalidar na prática um token antigo: GET /me passa a retornar 404', async () => {
    const { token } = await createRiderWithToken({ email: 'tokenantigo@test.com', password: '123456' });

    await request(app).post(DELETE_URL).send({ email: 'tokenantigo@test.com', password: '123456' });

    const me = await request(app).get('/api/riders/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(404);
  });

  // =====================
  // Entregas já feitas são mantidas
  // =====================
  it('deve manter as entregas já concluídas do entregador', async () => {
    const rider = await createRider({ email: 'historico@test.com', password: '123456' });
    const delivery = await createDelivery({ rider: rider._id, status: 4, deliveredAt: new Date() });

    const res = await request(app).post(DELETE_URL).send({ email: 'historico@test.com', password: '123456' });

    expect(res.status).toBe(200);
    const kept = await Delivery.findById(delivery._id);
    expect(kept).not.toBeNull();
    expect(kept.status).toBe(4);
    expect(kept.riderPayout).toBe(6);
  });

  // =====================
  // Credenciais
  // =====================
  it('deve retornar 400 com senha incorreta e não excluir nada', async () => {
    const rider = await createRider({ email: 'senhaerrada@test.com', password: '123456' });

    const res = await request(app).post(DELETE_URL).send({ email: 'senhaerrada@test.com', password: 'errada' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Email ou senha inválidos.');
    expect(await Rider.findById(rider._id)).not.toBeNull();
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });

  it('deve retornar a mesma mensagem genérica para e-mail inexistente', async () => {
    const res = await request(app).post(DELETE_URL).send({ email: 'ninguem@test.com', password: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Email ou senha inválidos.');
  });

  it('deve retornar 400 com detalhes quando faltar e-mail e senha', async () => {
    const res = await request(app).post(DELETE_URL).send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Dados inválidos');
    const fields = res.body.details.map((d) => d.field);
    expect(fields).toContain('email');
    expect(fields).toContain('password');
  });

  // =====================
  // Entrega em andamento
  // =====================
  it.each([1, 2, 3])('deve retornar 409 e não excluir quando há entrega em andamento (status %i)', async (status) => {
    const rider = await createRider({ email: `ativo${status}@test.com`, password: '123456' });
    await createDelivery({ rider: rider._id, status });

    const res = await request(app).post(DELETE_URL).send({ email: `ativo${status}@test.com`, password: '123456' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/entrega em andamento/);
    expect(await Rider.findById(rider._id)).not.toBeNull();
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });

  it('não deve bloquear por entrega de outro entregador', async () => {
    const other = await createRider({ email: 'outro@test.com' });
    await createDelivery({ rider: other._id, status: 2 });
    await createRider({ email: 'livre@test.com', password: '123456' });

    const res = await request(app).post(DELETE_URL).send({ email: 'livre@test.com', password: '123456' });

    expect(res.status).toBe(200);
  });

  // =====================
  // Cloudinary
  // =====================
  it('deve apagar a imagem no Cloudinary quando o entregador tem avatar ou documento', async () => {
    const rider = await createRider({
      email: 'comfoto@test.com',
      password: '123456',
      avatar: 'https://res.cloudinary.com/demo/image/upload/v1/delivroo/riders/rider_x.jpg',
    });

    const res = await request(app).post(DELETE_URL).send({ email: 'comfoto@test.com', password: '123456' });

    expect(res.status).toBe(200);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(1);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(`delivroo/riders/rider_${rider._id}`, { invalidate: true });
  });

  it('não deve chamar o Cloudinary quando o entregador não enviou nenhuma imagem', async () => {
    await createRider({ email: 'semfoto@test.com', password: '123456' });

    const res = await request(app).post(DELETE_URL).send({ email: 'semfoto@test.com', password: '123456' });

    expect(res.status).toBe(200);
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });

  it('deve retornar 500 e NÃO apagar a conta se o Cloudinary falhar (para poder tentar de novo)', async () => {
    const rider = await createRider({
      email: 'cloudfalha@test.com',
      password: '123456',
      documentImage: 'https://res.cloudinary.com/demo/image/upload/v1/delivroo/riders/rider_y.jpg',
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    cloudinary.uploader.destroy.mockRejectedValueOnce(new Error('cloudinary fora do ar'));

    const res = await request(app).post(DELETE_URL).send({ email: 'cloudfalha@test.com', password: '123456' });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Tente novamente/);
    expect(await Rider.findById(rider._id)).not.toBeNull();

    // segunda tentativa funciona
    const retry = await request(app).post(DELETE_URL).send({ email: 'cloudfalha@test.com', password: '123456' });
    expect(retry.status).toBe(200);
    expect(await Rider.findById(rider._id)).toBeNull();
    consoleSpy.mockRestore();
  });
});