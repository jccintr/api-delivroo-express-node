import  { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
//import Delivery from '../models/delivery.js';
import {createStore,createStoreWithToken} from './factories/store.factory.js'
import {createDelivery,createDeliveryPayload} from './factories/delivery.factory.js'
import Store from '../models/store.js';

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
    });
    it('deve retornar 400 quando destino não for informado', async () => {
      const {token} = await createStoreWithToken({ password: '123456' });
      const deliveryPayload =  createDeliveryPayload();

      delete deliveryPayload.destino;
      const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Dados do destinatário são obrigatórios');
    });
    it('deve retornar 400 quando o nome do destino não for informado', async () => {
      const { token } = await createStoreWithToken({ password: '123456' });
      const deliveryPayload =  createDeliveryPayload();
      deliveryPayload.destino.nome = "";
      const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Nome do destinatário é obrigatório');
    });
    it('deve retornar 400 quando o telefone do destino não for informado', async () => {
      const { token } = await createStoreWithToken({ password: '123456' });
      const deliveryPayload =  createDeliveryPayload();
      deliveryPayload.destino.telefone = "";
      const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Telefone do destinatário é obrigatório');
    });
    it('deve retornar 400 quando o endereço do destino não for informado', async () => {
      const { token } = await createStoreWithToken({ password: '123456' });
      const deliveryPayload =  createDeliveryPayload();
      deliveryPayload.destino.address = "";
      const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Endereço de entrega é obrigatório');
    });
    it('deve retornar 400 quando a latitude do destino não for informado (valor 0)', async () => {
      const { token } = await createStoreWithToken({ password: '123456' });
      const deliveryPayload =  createDeliveryPayload();
      deliveryPayload.destino.latitude = 0;
      const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Latitude do destino não pode ser zero');
    });
    it('deve retornar 400 quando a longitude do destino não for informado (valor 0)', async () => {
      const { token } = await createStoreWithToken({ password: '123456' });
      const deliveryPayload =  createDeliveryPayload();
      deliveryPayload.destino.longitude = 0;
      const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Longitude do destino não pode ser zero');
    });
    it('deve retornar 400 quando a latitude do destino for inválida', async () => {
      const { token } = await createStoreWithToken({ password: '123456' });
      const deliveryPayload =  createDeliveryPayload();
      deliveryPayload.destino.latitude = -92;
      const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Latitude do destino inválida');
    });
    it('deve retornar 400 quando a longitude do destino for inválida', async () => {
      const { token } = await createStoreWithToken({ password: '123456' });
      const deliveryPayload =  createDeliveryPayload();
      deliveryPayload.destino.longitude = -181;
      const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Longitude do destino inválida');
    });
    it('deve retornar 400 quando package não for informado', async () => {
      const {token} = await createStoreWithToken({ password: '123456' });
      const deliveryPayload =  createDeliveryPayload();
      
      delete deliveryPayload.package;

      const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Dados do pacote são obrigatórios');
    });
    it('deve retornar 400 quando a descricao do package não for informado', async () => {
      const {token} = await createStoreWithToken({ password: '123456' });
      const deliveryPayload =  createDeliveryPayload();
      
       deliveryPayload.package.description = "";

      const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Descrição do pacote é obrigatória');
    });
    it('deve retornar 400 quando a categoria do package for inválida', async () => {
      const {token} = await createStoreWithToken({ password: '123456' });
      const deliveryPayload =  createDeliveryPayload();
      
       deliveryPayload.package.category = "Móveis";

      const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Categoria inválida');
    });
    it('deve retornar 400 quando a categoria do package estiver em branco', async () => {
      const {token} = await createStoreWithToken({ password: '123456' });
      const deliveryPayload =  createDeliveryPayload();
      
       deliveryPayload.package.category = "";

      const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Categoria inválida');
    });
    it('deve retornar 400 quando a quantidade do package for 0', async () => {
      const {token} = await createStoreWithToken({ password: '123456' });
      const deliveryPayload =  createDeliveryPayload();
      
       deliveryPayload.package.quantity = 0;

      const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Quantidade deve ser pelo menos 1');
    });
    it('deve retornar 400 quando a quantidade do package for negativa', async () => {
      const {token} = await createStoreWithToken({ password: '123456' });
      const deliveryPayload =  createDeliveryPayload();
      
       deliveryPayload.package.quantity = -1;

      const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Quantidade deve ser pelo menos 1');
    });
    it('deve retornar 400 quando o peso do package for negativo', async () => {
      const {token} = await createStoreWithToken({ password: '123456' });
      const deliveryPayload =  createDeliveryPayload();
      
       deliveryPayload.package.weight = -1;

      const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Peso inválido');
    });
    it('deve retornar 400 quando o valor declarado do package for negativo', async () => {
      const {token} = await createStoreWithToken({ password: '123456' });
      const deliveryPayload =  createDeliveryPayload();
      
       deliveryPayload.package.declaredvalue = -1;

      const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Valor declarado inválido');
    });
    it('deve retornar 400 quando a forma de pagamento do package for inválida', async () => {
      const {token} = await createStoreWithToken({ password: '123456' });
      const deliveryPayload =  createDeliveryPayload();
      
       deliveryPayload.package.payment = "Bitcoin";

      const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Forma de pagamento inválida');
    });
    it('deve retornar 400 quando a forma de pagamento do package estiver em branco', async () => {
      const {token} = await createStoreWithToken({ password: '123456' });
      const deliveryPayload =  createDeliveryPayload();
      
       deliveryPayload.package.payment = "";

      const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Forma de pagamento inválida');
    });
    it('deve retornar 400 quando cashChange do package for negativo', async () => {
      const {token} = await createStoreWithToken({ password: '123456' });
      const deliveryPayload =  createDeliveryPayload();
      
       deliveryPayload.package.cashChange = -5.9;

      const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Valor de troco inválido');
    });
    it('deve retornar 400 quando amountDue do package for negativo', async () => {
      const {token} = await createStoreWithToken({ password: '123456' });
      const deliveryPayload =  createDeliveryPayload();
      
       deliveryPayload.package.amountDue = -5.9;

      const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Valor a receber do cliente inválido');
    });
    it('deve retornar 404 quando store não existir', async () => {
      const {token,store} = await createStoreWithToken({ password: '123456' });
      const deliveryPayload =  createDeliveryPayload();

      await Store.findByIdAndDelete(store._id);
     
      const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Loja não encontrada.');
     
    });
    it('deve retornar 403 quando a conta estiver desativada', async () => {
      const {token,store} = await createStoreWithToken({ password: '123456' });
      const deliveryPayload =  createDeliveryPayload();

      await Store.findByIdAndUpdate(store._id, { active: false });
     
      const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Conta desativada.');
     
    });
    it('deve retornar 403 quando a conta não estiver verificada', async () => {
      const {token,store} = await createStoreWithToken({ password: '123456' });
      const deliveryPayload =  createDeliveryPayload();

      await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: null });
     
      const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Conta ainda não verificada.');
     
    });
     it('deve retornar 400 quando address.latitude não tiver sido cadastrada na loja', async () => {
       const {token,store} = await createStoreWithToken({ password: '123456' });
       const deliveryPayload =  createDeliveryPayload();
       await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), address:{latitude: null} });
      
       const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);

          
         expect(res.status).toBe(400);
         expect(res.body.error).toBe('Cadastre o endereço completo da loja (com localização) antes de criar uma entrega.');
    });
    it('deve retornar 400 quando address.longitude não tiver sido cadastrada na loja', async () => {
       const {token,store} = await createStoreWithToken({ password: '123456' });
       const deliveryPayload =  createDeliveryPayload();
       await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), address:{longitude: null} });
      
       const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);

          
         expect(res.status).toBe(400);
         expect(res.body.error).toBe('Cadastre o endereço completo da loja (com localização) antes de criar uma entrega.');
    });
    it('deve retornar 400 quando o endereço da loja não tiver sido cadastrado.', async () => {
       const {token,store} = await createStoreWithToken({ password: '123456' });
       const deliveryPayload =  createDeliveryPayload();
       const nullAddress = { street: null, number: null, complement: null, district:null , city:null, state:null, zipCode:null, latitude: null, longitude: null }
       await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), address: nullAddress });
      
       const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);

          
         expect(res.status).toBe(400);
         expect(res.body.error).toBe('Cadastre o endereço completo da loja (com localização) antes de criar uma entrega.');
    });
     it('deve retornar 201, calcular a distância, calcular o valor a ser pago ao entregador e retornar a entrega, quando os dados forem válidos e a conta estiver verificada,ativa e com o endereço corretamente preenchido', async () => {
       const {token,store} = await createStoreWithToken({ password: '123456' });
       const deliveryPayload =  createDeliveryPayload();
       await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date() });
      
       const res = await request(app)
         .post('/api/stores/deliveries')
         .set('Authorization', `Bearer ${token}`)
         .send(deliveryPayload);

         console.log(res.body); 
         expect(res.status).toBe(201);
         expect(res.body.status).toBe(0);
         expect(res.body.rider).toBeNull();
         expect(res.body.distancia).toBeGreaterThan(0);
         expect(res.body.events).toBeInstanceOf(Array);
         expect(res.body.events[0].descricao).toBe('Entrega criada pela loja');
         expect(res.body.riderPayout).toBeGreaterThan(0);
         
    });
  });
});