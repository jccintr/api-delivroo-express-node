import  { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
//import Delivery from '../models/delivery.js';
import {createStore,createStoreWithToken} from './factories/store.factory.js'
import {createDelivery,} from './factories/delivery.factory.js'

describe('delivery Routes', () => {
  // =====================
  // CREATE DELIVERY
  // =====================
  describe('POST /api/stores/deliveries', () => {
     it('deve retornar 401 quando não autenticado (sem token)', async () => {
      const res = await request(app).post('/api/stores/deliveries');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });
    it('deve retornar 401 quando token for inválido', async () => {
     const {token} = await createStoreWithToken({ password: '123456' });   
     const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}-invalido`);
     
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });/*
    it('deve retornar 400 quando destino não for informado', async () => {
      const {token} = await createStoreWithToken({ password: '123456' });
      const delivery = await createDelivery();
      delete delivery.destino;
      const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(delivery);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Dados do destinatário são obrigatórios');
    });*/
    it('deve retornar 400 quando o nome do destino não for informado', async () => {
      const { token } = await createStoreWithToken({ password: '123456' });
      const delivery = await createDelivery();
      delivery.destino.nome = "";
      console.log(delivery);
      const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(delivery);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Nome do destinatário é obrigatório');
    });
  });
});