import  { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import Delivery from '../models/delivery.js';
import {createStore,createStoreWithToken} from './factories/store.factory.js'
import {createDelivery,createDeliveryPayload} from './factories/delivery.factory.js'
import {createRider,createRiderWithToken} from './factories/rider.factory.js'
import Store from '../models/store.js';
import Rider from '../models/rider.js';

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
     
      expect(res.body.details.some((d) => d.message === 'Dados do destinatário são obrigatórios')).toBe(true);
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

         
         expect(res.status).toBe(201);
         expect(res.body.status).toBe(0);
         expect(res.body.rider).toBeNull();
         expect(res.body.distancia).toBeGreaterThan(0);
         expect(res.body.events).toBeInstanceOf(Array);
         expect(res.body.events[0].descricao).toBe('Entrega criada pela loja');
         expect(res.body.riderPayout).toBeGreaterThan(0);
         
    });
  });
  // =====================
  // List Available Deliveries
  // =====================
  describe('GET /api/riders/deliveries/available', () => {
    it('deve retornar 401 quando não autenticado (sem token)', async () => {
      const res = await request(app).get('/api/riders/deliveries/available');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });
    it('deve retornar 401 quando token for inválido', async () => {
     const { token } = await createRiderWithToken({ password: '123456' });   
     const res = await request(app)
         .get('/api/riders/deliveries/available')
         .set('Authorization', `Bearer ${token}-invalido`);
     
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });
    it('deve retornar 403 quando a conta estiver desativada', async () => {
        const { token, rider } = await createRiderWithToken({ password: '123456' });

        await Rider.findByIdAndUpdate(rider._id, { active: false });

        const res = await request(app)
         .get('/api/riders/deliveries/available')
         .set('Authorization', `Bearer ${token}`);

         expect(res.status).toBe(403);
         expect(res.body.error).toBe('Conta desativada.');
    });
    it('deve retornar 403 quando a conta não estiver verificada', async () => {
        const { token, rider } = await createRiderWithToken({ password: '123456' });

        await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: null, active: true });

        const res = await request(app)
         .get('/api/riders/deliveries/available')
         .set('Authorization', `Bearer ${token}`);

         expect(res.status).toBe(403);
         expect(res.body.error).toBe('Conta ainda não verificada.');
    });
    it('deve retornar 403 quando a conta ainda não estiver aprovada', async () => {
        const { token, rider } = await createRiderWithToken({ password: '123456' });

        await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true });

        const res = await request(app)
         .get('/api/riders/deliveries/available')
         .set('Authorization', `Bearer ${token}`);

         expect(res.status).toBe(403);
         expect(res.body.error).toBe('Conta ainda não aprovada.');
    });
    it('deve retornar 404 quando a rider não existir', async () => {
        const { token, rider } = await createRiderWithToken({ password: '123456' });

        await Rider.findByIdAndDelete(rider._id);

        const res = await request(app)
         .get('/api/riders/deliveries/available')
         .set('Authorization', `Bearer ${token}`);

         expect(res.status).toBe(404);
         expect(res.body.error).toBe('Entregador não encontrado.');
    });
    it('deve retornar 200 e um array de entregas disponíveis (status=0) quando rider estiver autenticado,ativo,verificado e aprovado', async () => {
        const { token, rider } = await createRiderWithToken({ password: '123456' });
        await createDelivery();
        await createDelivery();
        const delivery3 = await createDelivery();

        await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
        await Delivery.findByIdAndUpdate(delivery3._id, { status: 1 });

        const res = await request(app)
            .get('/api/riders/deliveries/available')
            .set('Authorization', `Bearer ${token}`);
        
        expect(res.status).toBe(200);
        expect(res.body).toBeInstanceOf(Array);
        expect(res.body.length).toBe(2);
        expect(res.body.every(delivery => delivery.status === 0)).toBe(true);
    
    });
    
  });
  // =====================
  // Rider Get Delivery By id
  // =====================
  describe('GET /api/riders/deliveries/:id', () => {
    it('deve retornar 401 quando não autenticado (sem token)', async () => {
      const deliveryId = '6a8a288269c7d67379404c00';
      const res = await request(app).get(`/api/riders/deliveries/${deliveryId}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });
    it('deve retornar 401 quando token for inválido', async () => {
     const { token } = await createRiderWithToken({ password: '123456' });   
      const deliveryId = '6a8a288269c7d67379404c00';
      const res = await request(app).get(`/api/riders/deliveries/${deliveryId}`)
            .set('Authorization', `Bearer ${token}-invalido`);
     
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });
    it('deve retornar 403 quando a conta estiver desativada', async () => {
       const deliveryId = '6a8a288269c7d67379404c00';
       const { token, rider } = await createRiderWithToken({ password: '123456' });
       await Rider.findByIdAndUpdate(rider._id, { active: false });

       const res = await request(app).get(`/api/riders/deliveries/${deliveryId}`)
            .set('Authorization', `Bearer ${token}`);
      
       expect(res.status).toBe(403);
       expect(res.body.error).toBe('Conta desativada.');
    });
    it('deve retornar 403 quando a conta não estiver verificada', async () => {
      const deliveryId = '6a8a288269c7d67379404c00';
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: null, active: true });

      const res = await request(app).get(`/api/riders/deliveries/${deliveryId}`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Conta ainda não verificada.');

    });
    it('deve retornar 403 quando a conta ainda não estiver aprovada', async () => {
      const deliveryId = '6a8a288269c7d67379404c00';
      const { token, rider } = await createRiderWithToken({ password: '123456' });

      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true });

      const res = await request(app).get(`/api/riders/deliveries/${deliveryId}`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Conta ainda não aprovada.');
    });
    it('deve retornar 404 quando a rider não existir', async () => {
      const deliveryId = '6a8a288269c7d67379404c00';
      const { token, rider } = await createRiderWithToken({ password: '123456' });

      await Rider.findByIdAndDelete(rider._id);

      const res = await request(app).get(`/api/riders/deliveries/${deliveryId}`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Entregador não encontrado.');
    });
    it('deve retornar 404 quando a entrega não existir', async () => {
      const deliveryId = '6a8a288269c7d67379404c00';
      const { token, rider } = await createRiderWithToken({ password: '123456' });

      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });

      const res = await request(app).get(`/api/riders/deliveries/${deliveryId}`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Entrega não encontrada.');
    });
    it('deve retornar 403 quando a entrega já tiver sido aceita por outro rider diferente', async () => {
      const { token, rider } = await createRiderWithToken();
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
      const delivery = await createDelivery();
      const anotherRider = await createRider();

      await Delivery.findByIdAndUpdate(delivery._id, { rider: anotherRider._id, status: 1 });

       const res = await request(app).get(`/api/riders/deliveries/${delivery._id}`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Corrida indisponível no momento.');

    });
    it('deve retornar 200 e a entrega quando a entrega ainda estiver disponível e o esntregador devidamente verificado, ativo e aprovado', async () => {
      const { token, rider } = await createRiderWithToken();
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
      const delivery = await createDelivery();

      const res = await request(app).get(`/api/riders/deliveries/${delivery._id}`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(0);
      expect(res.body._id).toBe(delivery._id.toString());
      expect(res.body.rider).toBeNull();
      expect(res.body.distancia).toBeGreaterThan(0);
      expect(res.body.events).toBeInstanceOf(Array);
      expect(res.body.riderPayout).toBeGreaterThan(0);
    });
     
  });
});



// delivery status
//-2: entrega cancelada pelo entregador => motivo
//-1: entrega cancelada pela loja => motivo
// 0: entrega solicitada pela loja
// 1: entrega aceita pelo entregador
// 2: pacote retirado pelo entregador
// 3: entregador a caminho do destino
// 4: pacote entregue
// 5: pacote devolvido a loja => motivo

/*  sugestão do claude
0: solicitada pela loja
1: aceita pelo entregador
2: pacote retirado
3: a caminho do destino
4: entregue
5: devolvida à loja        (motivo)
6: cancelada pela loja      (motivo)
7: cancelada pelo entregador (motivo)

*/


/*

status	significado	quem dispara	pré-condição
0	solicitada	loja (createDelivery)	—
1	aceita	rider	status 0, rider null
2	retirada	rider	status 1, rider = eu
3	a caminho	rider	status 2, rider = eu
4	entregue	rider	status 3, rider = eu
5	devolvida à loja (motivo)	rider	status 2 ou 3, rider = eu
6	cancelada pela loja (motivo)	loja	status 0 ou 1
7	cancelada pelo rider (motivo), volta pra 0	rider	status 1, rider = eu → reseta pra status:0, rider:null



*/

