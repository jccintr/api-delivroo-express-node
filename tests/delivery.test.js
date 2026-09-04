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
  // List Store Active Deliveries
  // =====================
  describe('GET /api/stores/deliveries/active', () => {
    it('deve retornar 401 quando não autenticado (sem token)', async () => {
      const res = await request(app).get('/api/stores/deliveries/active');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });
    it('deve retornar 401 quando token for inválido', async () => {
      const { token } = await createStoreWithToken({ password: '123456' });
      const res = await request(app)
        .get('/api/stores/deliveries/active')
        .set('Authorization', `Bearer ${token}-invalido`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });
    it('deve retornar 403 quando a conta estiver desativada', async () => {
      const { token, store } = await createStoreWithToken({ password: '123456' });
      await Store.findByIdAndUpdate(store._id, { active: false });

      const res = await request(app)
        .get('/api/stores/deliveries/active')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Conta desativada.');
    });
    it('deve retornar 403 quando a conta não estiver verificada', async () => {
      const { token, store } = await createStoreWithToken({ password: '123456' });
      await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: null, active: true });

      const res = await request(app)
        .get('/api/stores/deliveries/active')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Conta ainda não verificada.');
    });
    it('deve retornar 404 quando a loja não existir', async () => {
      const { token, store } = await createStoreWithToken({ password: '123456' });
      await Store.findByIdAndDelete(store._id);

      const res = await request(app)
        .get('/api/stores/deliveries/active')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Loja não encontrada.');
    });
    it('deve retornar 200 com array vazio quando a loja não tiver nenhuma entrega em andamento', async () => {
      const { token, store } = await createStoreWithToken({ password: '123456' });
      await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: true });
      await createDelivery({ store: store._id, status: 4 }); // já entregue, não conta como "em andamento"
      await createDelivery(); // de outra loja, não deve aparecer

      const res = await request(app)
        .get('/api/stores/deliveries/active')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(0);
    });
    it('deve retornar 200 e as entregas em andamento (status 0, 1, 2 ou 3) da própria loja, sem trazer as de outra loja nem as finalizadas', async () => {
      const { token, store } = await createStoreWithToken({ password: '123456' });
      await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: true });
      const rider = await createRider();

      const requested = await createDelivery({ store: store._id, status: 0 });
      const accepted = await createDelivery({ store: store._id, status: 1, rider: rider._id });
      const pickedUp = await createDelivery({ store: store._id, status: 2, rider: rider._id });
      const dispatched = await createDelivery({ store: store._id, status: 3, rider: rider._id });
      await createDelivery({ store: store._id, status: 4, rider: rider._id }); // entregue, não deve aparecer
      await createDelivery({ store: store._id, status: 5 }); // devolvida, não deve aparecer
      await createDelivery({ store: store._id, status: 6 }); // cancelada, não deve aparecer
      await createDelivery(); // de outra loja, não deve aparecer

      const res = await request(app)
        .get('/api/stores/deliveries/active')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(4);
      const ids = res.body.map((d) => d._id);
      expect(ids).toEqual(expect.arrayContaining([
        requested._id.toString(),
        accepted._id.toString(),
        pickedUp._id.toString(),
        dispatched._id.toString(),
      ]));
      expect(res.body.every((d) => [0, 1, 2, 3].includes(d.status))).toBe(true);
      // rider populado quando já atribuído, para a loja saber quem está com o pacote
      const withRider = res.body.find((d) => d._id === accepted._id.toString());
      expect(withRider.rider).toHaveProperty('name');
      expect(withRider.rider).toHaveProperty('vehicle');
      // entrega ainda sem rider (status 0) deve vir com rider null
      const withoutRider = res.body.find((d) => d._id === requested._id.toString());
      expect(withoutRider.rider).toBeNull();
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
        await createDelivery({ city: rider.city });
        await createDelivery({ city: rider.city });
        const delivery3 = await createDelivery({ city: rider.city });

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
    it('não deve retornar entregas de lojas de outra cidade', async () => {
        const { token, rider } = await createRiderWithToken({ password: '123456' });
        await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });

        await createDelivery({ city: rider.city }); // mesma cidade, deve aparecer
        await createDelivery(); // cidade diferente (createDelivery cria uma loja/cidade nova por padrão), não deve aparecer

        const res = await request(app)
            .get('/api/riders/deliveries/available')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
    });
    
  });
    // =====================
  // Rider Get Active Deliveries
  // =====================
  describe('GET /api/riders/deliveries/active', () => {
    it('deve retornar 401 quando não autenticado (sem token)', async () => {
      const res = await request(app).get('/api/riders/deliveries/active');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });
    it('deve retornar 401 quando token for inválido', async () => {
     const { token } = await createRiderWithToken({ password: '123456' });   
     const res = await request(app)
         .get('/api/riders/deliveries/active')
         .set('Authorization', `Bearer ${token}-invalido`);
     
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });
    it('deve retornar 403 quando a conta estiver desativada', async () => {
        const { token, rider } = await createRiderWithToken({ password: '123456' });

        await Rider.findByIdAndUpdate(rider._id, { active: false });

        const res = await request(app)
         .get('/api/riders/deliveries/active')
         .set('Authorization', `Bearer ${token}`);

         expect(res.status).toBe(403);
         expect(res.body.error).toBe('Conta desativada.');
    });
    it('deve retornar 403 quando a conta não estiver verificada', async () => {
        const { token, rider } = await createRiderWithToken({ password: '123456' });

        await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: null, active: true });

        const res = await request(app)
         .get('/api/riders/deliveries/active')
         .set('Authorization', `Bearer ${token}`);

         expect(res.status).toBe(403);
         expect(res.body.error).toBe('Conta ainda não verificada.');
    });
    it('deve retornar 403 quando a conta ainda não estiver aprovada', async () => {
        const { token, rider } = await createRiderWithToken({ password: '123456' });

        await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true });

        const res = await request(app)
         .get('/api/riders/deliveries/active')
         .set('Authorization', `Bearer ${token}`);

         expect(res.status).toBe(403);
         expect(res.body.error).toBe('Conta ainda não aprovada.');
    });
    it('deve retornar 404 quando a rider não existir', async () => {
        const { token, rider } = await createRiderWithToken({ password: '123456' });

        await Rider.findByIdAndDelete(rider._id);

        const res = await request(app)
         .get('/api/riders/deliveries/active')
         .set('Authorization', `Bearer ${token}`);

         expect(res.status).toBe(404);
         expect(res.body.error).toBe('Entregador não encontrado.');
    });
    it('deve retornar 200 com array vazio quando o rider não tiver nenhuma entrega em andamento', async () => {
        const { token, rider } = await createRiderWithToken({ password: '123456' });
        await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
        await createDelivery(); // disponível, não é do rider
        await createDelivery({ status: 4, rider: rider._id }); // já entregue, não conta como "ativa"

        const res = await request(app)
            .get('/api/riders/deliveries/active')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toBeInstanceOf(Array);
        expect(res.body.length).toBe(0);
    });
    it('deve retornar 200 e as entregas do próprio rider com status 1, 2 ou 3, sem trazer as de outro rider', async () => {
        const { token, rider } = await createRiderWithToken({ password: '123456' });
        await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
        const anotherRider = await createRider();

        const accepted = await createDelivery({ status: 1, rider: rider._id });
        const pickedUp = await createDelivery({ status: 2, rider: rider._id });
        const dispatched = await createDelivery({ status: 3, rider: rider._id });
        await createDelivery({ status: 4, rider: rider._id }); // entregue, não deve aparecer
        await createDelivery({ status: 1, rider: anotherRider._id }); // de outro rider, não deve aparecer
        await createDelivery(); // disponível, não deve aparecer

        const res = await request(app)
            .get('/api/riders/deliveries/active')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(3);
        const ids = res.body.map((d) => d._id);
        expect(ids).toEqual(expect.arrayContaining([
          accepted._id.toString(),
          pickedUp._id.toString(),
          dispatched._id.toString(),
        ]));
        expect(res.body.every((d) => [1, 2, 3].includes(d.status))).toBe(true);
        // dados da loja populados, para exibir na tela Home
        expect(res.body[0].store).toHaveProperty('name');
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
      expect(res.body.error).toBe('Você não tem permissão para ver esta entrega.');

    });
    it('deve retornar 200 e a entrega quando a entrega ainda estiver disponível e o esntregador devidamente verificado, ativo e aprovado', async () => {
      const { token, rider } = await createRiderWithToken();
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
      const delivery = await createDelivery({ city: rider.city });

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
    it('deve retornar 404 (como se não existisse) quando a entrega disponível for de outra cidade', async () => {
      const { token, rider } = await createRiderWithToken();
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
      const delivery = await createDelivery(); // cidade diferente da do rider

      const res = await request(app).get(`/api/riders/deliveries/${delivery._id}`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Entrega não encontrada.');
    });
     
  });
  // =====================
  // ACCEPT DELIVERY
  // =====================
  describe('POST /api/riders/deliveries/:id/accept', () => {
    it('deve retornar 401 quando não autenticado (sem token)', async () => {
      const deliveryId = '6a8a288269c7d67379404c00';
      const res = await request(app).post(`/api/riders/deliveries/${deliveryId}/accept`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });

    it('deve retornar 401 quando token for inválido', async () => {
      const { token } = await createRiderWithToken({ password: '123456' });
      const deliveryId = '6a8a288269c7d67379404c00';

      const res = await request(app).post(`/api/riders/deliveries/${deliveryId}/accept`)
            .set('Authorization', `Bearer ${token}-invalido`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });

    it('deve retornar 403 quando a conta estiver desativada', async () => {
      const deliveryId = '6a8a288269c7d67379404c00';
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { active: false });

      const res = await request(app).post(`/api/riders/deliveries/${deliveryId}/accept`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Conta desativada.');
    });

    it('deve retornar 403 quando a conta não estiver verificada', async () => {
      const deliveryId = '6a8a288269c7d67379404c00';
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: null, active: true });

      const res = await request(app).post(`/api/riders/deliveries/${deliveryId}/accept`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Conta ainda não verificada.');
    });

    it('deve retornar 403 quando a conta ainda não estiver aprovada', async () => {
      const deliveryId = '6a8a288269c7d67379404c00';
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true });

      const res = await request(app).post(`/api/riders/deliveries/${deliveryId}/accept`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Conta ainda não aprovada.');
    });

    it('deve retornar 404 quando a rider não existir', async () => {
      const deliveryId = '6a8a288269c7d67379404c00';
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndDelete(rider._id);

      const res = await request(app).post(`/api/riders/deliveries/${deliveryId}/accept`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Entregador não encontrado.');
    });

    it('deve retornar 404 quando a entrega não existir', async () => {
      const deliveryId = '6a8a288269c7d67379404c00';
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });

      const res = await request(app).post(`/api/riders/deliveries/${deliveryId}/accept`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Entrega não encontrada.');
    });

    it('deve retornar 409 quando a entrega já não estiver mais disponível (já aceita por outro rider)', async () => {
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
      const anotherRider = await createRider();
      const delivery = await createDelivery({ status: 1, rider: anotherRider._id, city: rider.city });

      const res = await request(app).post(`/api/riders/deliveries/${delivery._id}/accept`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Esta entrega não está mais disponível.');
    });

    it('deve retornar 409 quando a entrega já tiver sido cancelada pela loja', async () => {
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
      const delivery = await createDelivery({ status: 6, cancelReason: 'Pedido duplicado', city: rider.city });

      const res = await request(app).post(`/api/riders/deliveries/${delivery._id}/accept`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Esta entrega não está mais disponível.');
    });

    it('deve retornar 404 (como se não existisse) quando a entrega for de outra cidade, mesmo já estando indisponível', async () => {
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
      const anotherRider = await createRider();
      // cidade diferente da do rider — nem o "409 de conflito" deve vazar aqui
      const delivery = await createDelivery({ status: 1, rider: anotherRider._id });

      const res = await request(app).post(`/api/riders/deliveries/${delivery._id}/accept`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Entrega não encontrada.');
    });

    it('deve retornar 404 quando tentar aceitar uma entrega disponível de outra cidade (nunca deveria estar visível para este rider)', async () => {
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
      const delivery = await createDelivery(); // cidade diferente da do rider

      const res = await request(app).post(`/api/riders/deliveries/${delivery._id}/accept`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Entrega não encontrada.');

      const unchanged = await Delivery.findById(delivery._id);
      expect(unchanged.status).toBe(0);
      expect(unchanged.rider).toBeNull();
    });

    it('deve aceitar a entrega com sucesso: status 0 → 1, rider atribuído, acceptedAt preenchido e evento registrado', async () => {
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
      const delivery = await createDelivery({ city: rider.city });

      const res = await request(app).post(`/api/riders/deliveries/${delivery._id}/accept`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(1);
      expect(res.body.rider).toBe(rider._id.toString());
      expect(res.body.acceptedAt).not.toBeNull();
      expect(res.body.events).toHaveLength(1); // a factory de teste não popula o evento de criação, só o aceite adiciona um
      expect(res.body.events[0].descricao).toBe('Entrega aceita pelo entregador');
      // dados da loja populados, para o rider identificar quem solicitou
      expect(res.body.store).toHaveProperty('name');
    });

    it('deve retornar 409 na segunda tentativa quando dois riders da mesma cidade aceitam a mesma entrega em sequência (evita corrida)', async () => {
      const { token: tokenA, rider: riderA } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(riderA._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
      const { token: tokenB, rider: riderB } = await createRiderWithToken({ password: '123456', city: riderA.city });
      await Rider.findByIdAndUpdate(riderB._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
      const delivery = await createDelivery({ city: riderA.city });

      const resA = await request(app).post(`/api/riders/deliveries/${delivery._id}/accept`)
            .set('Authorization', `Bearer ${tokenA}`);
      const resB = await request(app).post(`/api/riders/deliveries/${delivery._id}/accept`)
            .set('Authorization', `Bearer ${tokenB}`);

      expect(resA.status).toBe(200);
      expect(resA.body.rider).toBe(riderA._id.toString());

      expect(resB.status).toBe(409);
      expect(resB.body.error).toBe('Esta entrega não está mais disponível.');
    });
  });
    // =====================
  // PICKUP DELIVERY
  // =====================
  describe('POST /api/riders/deliveries/:id/pickup', () => {
    it('deve retornar 401 quando não autenticado (sem token)', async () => {
      const delivery = await createDelivery({ status: 1 });
      const res = await request(app).post(`/api/riders/deliveries/${delivery._id}/pickup`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });

    it('deve retornar 404 quando a entrega não existir', async () => {
      const deliveryId = '6a8a288269c7d67379404c00';
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });

      const res = await request(app).post(`/api/riders/deliveries/${deliveryId}/pickup`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Entrega não encontrada.');
    });

    it('deve retornar 409 quando a entrega ainda não tiver sido aceita (status 0)', async () => {
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
      const delivery = await createDelivery();

      const res = await request(app).post(`/api/riders/deliveries/${delivery._id}/pickup`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Não foi possível confirmar a retirada desta entrega.');
    });

    it('deve retornar 409 quando o rider autenticado não for o rider atribuído à entrega', async () => {
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
      const anotherRider = await createRider();
      const delivery = await createDelivery({ status: 1, rider: anotherRider._id });

      const res = await request(app).post(`/api/riders/deliveries/${delivery._id}/pickup`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Não foi possível confirmar a retirada desta entrega.');
    });

    it('deve confirmar a retirada com sucesso: status 1 → 2 e pickedUpAt preenchido', async () => {
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
      const delivery = await createDelivery({ status: 1, rider: rider._id });

      const res = await request(app).post(`/api/riders/deliveries/${delivery._id}/pickup`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(2);
      expect(res.body.pickedUpAt).not.toBeNull();
      expect(res.body.events[0].descricao).toBe('Pacote retirado pelo entregador');
    });
  });

  // =====================
  // EN-ROUTE (A CAMINHO DO DESTINO)
  // =====================
  describe('POST /api/riders/deliveries/:id/en-route', () => {
    it('deve retornar 401 quando não autenticado (sem token)', async () => {
      const delivery = await createDelivery({ status: 2 });
      const res = await request(app).post(`/api/riders/deliveries/${delivery._id}/en-route`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });

    it('deve retornar 404 quando a entrega não existir', async () => {
      const deliveryId = '6a8a288269c7d67379404c00';
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });

      const res = await request(app).post(`/api/riders/deliveries/${deliveryId}/en-route`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Entrega não encontrada.');
    });

    it('deve retornar 409 quando o pacote ainda não tiver sido retirado (status 1)', async () => {
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
      const delivery = await createDelivery({ status: 1, rider: rider._id });

      const res = await request(app).post(`/api/riders/deliveries/${delivery._id}/en-route`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Não foi possível atualizar esta entrega.');
    });

    it('deve marcar como a caminho com sucesso: status 2 → 3 e dispatchedAt preenchido', async () => {
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
      const delivery = await createDelivery({ status: 2, rider: rider._id });

      const res = await request(app).post(`/api/riders/deliveries/${delivery._id}/en-route`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(3);
      expect(res.body.dispatchedAt).not.toBeNull();
      expect(res.body.events[0].descricao).toBe('Entregador a caminho do destino');
    });
  });

  // =====================
  // DELIVER
  // =====================
  describe('POST /api/riders/deliveries/:id/deliver', () => {
    it('deve retornar 401 quando não autenticado (sem token)', async () => {
      const delivery = await createDelivery({ status: 3 });
      const res = await request(app).post(`/api/riders/deliveries/${delivery._id}/deliver`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });

    it('deve retornar 404 quando a entrega não existir', async () => {
      const deliveryId = '6a8a288269c7d67379404c00';
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });

      const res = await request(app).post(`/api/riders/deliveries/${deliveryId}/deliver`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Entrega não encontrada.');
    });

    it('deve retornar 409 quando a entrega não estiver a caminho (status 2)', async () => {
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
      const delivery = await createDelivery({ status: 2, rider: rider._id });

      const res = await request(app).post(`/api/riders/deliveries/${delivery._id}/deliver`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Não foi possível confirmar a entrega deste pacote.');
    });

    it('deve confirmar a entrega com sucesso: status 3 → 4 e deliveredAt preenchido', async () => {
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
      const delivery = await createDelivery({ status: 3, rider: rider._id });

      const res = await request(app).post(`/api/riders/deliveries/${delivery._id}/deliver`)
            .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(4);
      expect(res.body.deliveredAt).not.toBeNull();
      expect(res.body.events[0].descricao).toBe('Pacote entregue');
    });
  });

  // =====================
  // RETURN (DEVOLUÇÃO À LOJA)
  // =====================
  describe('POST /api/riders/deliveries/:id/return', () => {
    it('deve retornar 401 quando não autenticado (sem token)', async () => {
      const delivery = await createDelivery({ status: 2 });
      const res = await request(app).post(`/api/riders/deliveries/${delivery._id}/return`)
            .send({ motivo: 'Cliente não encontrado' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });

    it('deve retornar 400 quando o motivo não for informado', async () => {
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
      const delivery = await createDelivery({ status: 2, rider: rider._id });

      const res = await request(app).post(`/api/riders/deliveries/${delivery._id}/return`)
            .set('Authorization', `Bearer ${token}`)
            .send({});

      expect(res.status).toBe(400);
      expect(res.body.details[0].message).toBe('Motivo é obrigatório');
    });

    it('deve retornar 404 quando a entrega não existir', async () => {
      const deliveryId = '6a8a288269c7d67379404c00';
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });

      const res = await request(app).post(`/api/riders/deliveries/${deliveryId}/return`)
            .set('Authorization', `Bearer ${token}`)
            .send({ motivo: 'Cliente não encontrado' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Entrega não encontrada.');
    });

    it('deve retornar 409 quando a entrega ainda não tiver sido retirada (status 1)', async () => {
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
      const delivery = await createDelivery({ status: 1, rider: rider._id });

      const res = await request(app).post(`/api/riders/deliveries/${delivery._id}/return`)
            .set('Authorization', `Bearer ${token}`)
            .send({ motivo: 'Cliente não encontrado no endereço' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Não foi possível registrar a devolução desta entrega.');
    });

    it('deve devolver com sucesso a partir de status 2 (retirada): status → 5 e cancelReason preenchido', async () => {
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
      const delivery = await createDelivery({ status: 2, rider: rider._id });

      const res = await request(app).post(`/api/riders/deliveries/${delivery._id}/return`)
            .set('Authorization', `Bearer ${token}`)
            .send({ motivo: 'Cliente não encontrado no endereço' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(5);
      expect(res.body.cancelReason).toBe('Cliente não encontrado no endereço');
      expect(res.body.events[0].descricao).toBe('Pacote devolvido à loja: Cliente não encontrado no endereço');
    });

    it('deve devolver com sucesso a partir de status 3 (a caminho)', async () => {
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
      const delivery = await createDelivery({ status: 3, rider: rider._id });

      const res = await request(app).post(`/api/riders/deliveries/${delivery._id}/return`)
            .set('Authorization', `Bearer ${token}`)
            .send({ motivo: 'Cliente recusou o pacote' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(5);
    });
  });

  // =====================
  // CANCEL BY RIDER (ANTES DA RETIRADA)
  // =====================
  describe('POST /api/riders/deliveries/:id/cancel', () => {
    it('deve retornar 401 quando não autenticado (sem token)', async () => {
      const delivery = await createDelivery({ status: 1 });
      const res = await request(app).post(`/api/riders/deliveries/${delivery._id}/cancel`)
            .send({ motivo: 'Mudei de ideia' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });

    it('deve retornar 400 quando o motivo não for informado', async () => {
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
      const delivery = await createDelivery({ status: 1, rider: rider._id });

      const res = await request(app).post(`/api/riders/deliveries/${delivery._id}/cancel`)
            .set('Authorization', `Bearer ${token}`)
            .send({});

      expect(res.status).toBe(400);
      expect(res.body.details[0].message).toBe('Motivo é obrigatório');
    });

    it('deve retornar 404 quando a entrega não existir', async () => {
      const deliveryId = '6a8a288269c7d67379404c00';
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });

      const res = await request(app).post(`/api/riders/deliveries/${deliveryId}/cancel`)
            .set('Authorization', `Bearer ${token}`)
            .send({ motivo: 'Mudei de ideia' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Entrega não encontrada.');
    });

    it('deve retornar 409 quando o pacote já tiver sido retirado (status 2)', async () => {
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
      const delivery = await createDelivery({ status: 2, rider: rider._id });

      const res = await request(app).post(`/api/riders/deliveries/${delivery._id}/cancel`)
            .set('Authorization', `Bearer ${token}`)
            .send({ motivo: 'Mudei de ideia' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Não foi possível cancelar esta entrega.');
    });

    it('deve cancelar com sucesso: status volta para 0 e rider volta para null (entrega reabre no pool)', async () => {
      const { token, rider } = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { emailVerifiedAt: new Date(), active: true, accountApprovedAt: new Date() });
      const delivery = await createDelivery({ status: 1, rider: rider._id, acceptedAt: new Date(), city: rider.city });

      const res = await request(app).post(`/api/riders/deliveries/${delivery._id}/cancel`)
            .set('Authorization', `Bearer ${token}`)
            .send({ motivo: 'Veículo com problema' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(0);
      expect(res.body.rider).toBeNull();
      expect(res.body.acceptedAt).toBeNull();

      // a entrega deve voltar a aparecer na lista de disponíveis
      const listRes = await request(app).get('/api/riders/deliveries/available')
            .set('Authorization', `Bearer ${token}`);
      expect(listRes.body.some((d) => d._id === delivery._id.toString())).toBe(true);
    });
  });

  // =====================
  // CANCEL BY STORE
  // =====================
  describe('POST /api/stores/deliveries/:id/cancel', () => {
    it('deve retornar 401 quando não autenticado (sem token)', async () => {
      const delivery = await createDelivery();
      const res = await request(app).post(`/api/stores/deliveries/${delivery._id}/cancel`)
            .send({ motivo: 'Pedido duplicado' });

      expect(res.status).toBe(401);
    });

    it('deve retornar 403 quando a conta estiver desativada', async () => {
      const { token, store } = await createStoreWithToken({ password: '123456' });
      await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: false });
      const delivery = await createDelivery({ store: store._id });

      const res = await request(app).post(`/api/stores/deliveries/${delivery._id}/cancel`)
            .set('Authorization', `Bearer ${token}`)
            .send({ motivo: 'Pedido duplicado' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Conta desativada.');
    });

    it('deve retornar 403 quando a conta não estiver verificada', async () => {
      const { token, store } = await createStoreWithToken({ password: '123456' });
      await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: null, active: true });
      const delivery = await createDelivery({ store: store._id });

      const res = await request(app).post(`/api/stores/deliveries/${delivery._id}/cancel`)
            .set('Authorization', `Bearer ${token}`)
            .send({ motivo: 'Pedido duplicado' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Conta ainda não verificada.');
    });

    it('deve retornar 400 quando o motivo não for informado', async () => {
      const { token, store } = await createStoreWithToken({ password: '123456' });
      await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: true });
      const delivery = await createDelivery({ store: store._id });

      const res = await request(app).post(`/api/stores/deliveries/${delivery._id}/cancel`)
            .set('Authorization', `Bearer ${token}`)
            .send({});

      expect(res.status).toBe(400);
      expect(res.body.details[0].message).toBe('Motivo é obrigatório');
    });

    it('deve retornar 404 quando a entrega não existir', async () => {
      const deliveryId = '6a8a288269c7d67379404c00';
      const { token, store } = await createStoreWithToken({ password: '123456' });
      await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: true });

      const res = await request(app).post(`/api/stores/deliveries/${deliveryId}/cancel`)
            .set('Authorization', `Bearer ${token}`)
            .send({ motivo: 'Pedido duplicado' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Entrega não encontrada.');
    });

    it('deve retornar 403 quando a entrega não pertencer à loja autenticada', async () => {
      const { token, store } = await createStoreWithToken({ password: '123456' });
      await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: true });
      const otherStoreDelivery = await createDelivery(); // pertence a outra loja

      const res = await request(app).post(`/api/stores/deliveries/${otherStoreDelivery._id}/cancel`)
            .set('Authorization', `Bearer ${token}`)
            .send({ motivo: 'Pedido duplicado' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Você não tem permissão para cancelar esta entrega.');
    });

    it('deve retornar 409 quando o pacote já tiver sido retirado (status 2)', async () => {
      const { token, store } = await createStoreWithToken({ password: '123456' });
      await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: true });
      const delivery = await createDelivery({ store: store._id, status: 2 });

      const res = await request(app).post(`/api/stores/deliveries/${delivery._id}/cancel`)
            .set('Authorization', `Bearer ${token}`)
            .send({ motivo: 'Pedido duplicado' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Não foi possível cancelar esta entrega.');
    });

    it('deve cancelar com sucesso a partir de status 0: status → 6 e cancelReason preenchido', async () => {
      const { token, store } = await createStoreWithToken({ password: '123456' });
      await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: true });
      const delivery = await createDelivery({ store: store._id });

      const res = await request(app).post(`/api/stores/deliveries/${delivery._id}/cancel`)
            .set('Authorization', `Bearer ${token}`)
            .send({ motivo: 'Pedido duplicado' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(6);
      expect(res.body.cancelReason).toBe('Pedido duplicado');
    });

    it('deve cancelar com sucesso a partir de status 1 (já aceita), mantendo o rider gravado', async () => {
      const { token, store } = await createStoreWithToken({ password: '123456' });
      await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date(), active: true });
      const rider = await createRider();
      const delivery = await createDelivery({ store: store._id, status: 1, rider: rider._id });

      const res = await request(app).post(`/api/stores/deliveries/${delivery._id}/cancel`)
            .set('Authorization', `Bearer ${token}`)
            .send({ motivo: 'Loja fechou mais cedo' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(6);
      expect(res.body.rider).toBe(rider._id.toString());
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