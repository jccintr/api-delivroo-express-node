import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { createRiderWithToken } from './factories/rider.factory.js';
import Rider from '../models/rider.js';

describe('PATCH /api/riders/me/push-token', () => {
  it('deve retornar 401 quando não autenticado (sem token)', async () => {
    const res = await request(app)
      .patch('/api/riders/me/push-token')
      .send({ pushToken: 'ExponentPushToken[abc123]' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Não autorizado');
  });

  it('deve retornar 400 quando pushToken não for informado', async () => {
    const { token } = await createRiderWithToken({ password: '123456' });

    const res = await request(app)
      .patch('/api/riders/me/push-token')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('deve retornar 400 quando pushToken tiver formato inválido', async () => {
    const { token } = await createRiderWithToken({ password: '123456' });

    const res = await request(app)
      .patch('/api/riders/me/push-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ pushToken: 'nao-parece-um-token-da-expo' });

    expect(res.status).toBe(400);
  });

  it('salva o pushToken no formato ExponentPushToken[...]', async () => {
    const { token, rider } = await createRiderWithToken({ password: '123456' });

    const res = await request(app)
      .patch('/api/riders/me/push-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ pushToken: 'ExponentPushToken[abc123]' });

    expect(res.status).toBe(200);
    expect(res.body.pushToken).toBe('ExponentPushToken[abc123]');

    const updated = await Rider.findById(rider._id).select('pushToken');
    expect(updated.pushToken).toBe('ExponentPushToken[abc123]');
  });

  it('salva o pushToken no formato mais novo ExpoPushToken[...]', async () => {
    const { token } = await createRiderWithToken({ password: '123456' });

    const res = await request(app)
      .patch('/api/riders/me/push-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ pushToken: 'ExpoPushToken[xyz789]' });

    expect(res.status).toBe(200);
    expect(res.body.pushToken).toBe('ExpoPushToken[xyz789]');
  });

  it('substitui o token anterior ao enviar um novo', async () => {
    const { token, rider } = await createRiderWithToken({
      password: '123456',
      pushToken: 'ExponentPushToken[antigo]',
    });

    await request(app)
      .patch('/api/riders/me/push-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ pushToken: 'ExponentPushToken[novo]' });

    const updated = await Rider.findById(rider._id).select('pushToken');
    expect(updated.pushToken).toBe('ExponentPushToken[novo]');
  });
});