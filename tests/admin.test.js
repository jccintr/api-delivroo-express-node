import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import Rider from '../models/rider.js';
import Store from '../models/store.js';
import City from '../models/city.js';
import Delivery from '../models/delivery.js';
import PlatformSettings from '../models/platformSettings.js';
import {createAdmin,createAdminWithToken} from './factories/admin.factory.js'
import {createStore} from './factories/store.factory.js'
import {createRider} from './factories/rider.factory.js'
import {createDelivery} from './factories/delivery.factory.js'
import {createCity} from './factories/city.factory.js'
import * as sendEmail from '../utils/sendEmailV2.js';

const adminPayload = {
  name: 'João Entregador',
  email: 'joao@test.com',
  password: '123456',
};




describe('Admin Routes', () => {
 
  // =====================
  // REGISTER
  // =====================
  describe('POST /api/admin/register', () => {
    it('deve cadastrar um admin com sucesso', async () => {
      const res = await request(app)
        .post('/api/admin/register')
        .send(adminPayload);

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Conta criada com sucesso.');
      expect(res.body.admin).toBeDefined();
      expect(res.body.admin.email).toBe(adminPayload.email);
      expect(res.body.admin.password).toBeUndefined(); // senha não deve voltar
    });

    it('deve retornar 400 se o email já existir', async () => {
      await request(app).post('/api/admin/register').send(adminPayload);

      const res = await request(app)
        .post('/api/admin/register')
        .send(adminPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email já cadastrado.');
    });

    it('deve retornar 400 se faltar campos obrigatórios', async () => {
      const res = await request(app)
        .post('/api/admin/register')
        .send({ email: 'incompleto@test.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
    });

    
  });

  // =====================
  // LOGIN
  // =====================
  describe('POST /api/admin/login', () => {
    
    it('deve fazer login com sucesso e retornar token', async () => {
     
      
      const admin = await createAdmin({name:'Julio Cesar', email:'julio@test.com', password:'123456'})
      const res = await request(app)
        .post('/api/admin/login')
        .send({
          email: 'julio@test.com',
          password: '123456',
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.email).toBe(admin.email);
      expect(res.body.password).toBeUndefined();
    });
    
    it('deve retornar 400 com senha incorreta', async () => {
      const res = await request(app)
        .post('/api/admin/login')
        .send({
          email: adminPayload.email,
          password: 'senha-errada',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email ou senha inválidos.');
    });

    it('deve retornar 400 com email inexistente', async () => {
      const res = await request(app)
        .post('/api/admin/login')
        .send({
          email: 'naoexiste@test.com',
          password: '123456',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email ou senha inválidos.');
    });

    it('deve retornar 403 se a conta estiver desativada', async () => {
    
      const admin = await createAdmin({name:'Julio Cesar', email:'julio@test.com', password:'123456',active:false})
      const res = await request(app)
        .post('/api/admin/login')
        .send({
          email: admin.email,
          password: '123456',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Conta desativada.');
    });
  });

  // =====================
  // VALIDATE TOKEN (GET /me)
  // =====================
  describe('GET /api/admin/me', () => {
  

    it('deve retornar os dados do admin autenticado', async () => {
      const {admin,token} = await createAdminWithToken();
      const res = await request(app)
        .get('/api/admin/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe(admin.email);
      expect(res.body.name).toBe(admin.name);
      expect(res.body.password).toBeUndefined();
    });

    it('deve retornar 401 sem token', async () => {
      const res = await request(app).get('/api/admin/me');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });

    it('deve retornar 401 com token inválido', async () => {
      const res = await request(app)
        .get('/api/admin/me')
        .set('Authorization', 'Bearer token-invalido');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });

    it('deve retornar 403 se a conta estiver desativada', async () => {
      const {token} = await createAdminWithToken({active:false});
      const res = await request(app)
        .get('/api/admin/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Conta desativada.');
    });
  });
  // =====================
  // CREATE
  // =====================
 describe('POST /api/admin/create', () => {
  
  const newAdminPayload = {
    name: 'Maria Admin',
    email: 'maria@test.com',  // e-mail diferente
    password: '123456',
  };

  it('deve cadastrar um admin com sucesso', async () => {
    const { token } = await createAdminWithToken();
    const res = await request(app)
      .post('/api/admin/create')
      .set('Authorization', `Bearer ${token}`)
      .send(newAdminPayload);  // ← e-mail novo

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Conta criada com sucesso.');
    expect(res.body.admin).toBeDefined();
    expect(res.body.admin.email).toBe(newAdminPayload.email);
    expect(res.body.admin.password).toBeUndefined();
  });

  it('deve retornar 400 se o email já existir', async () => {
     const { token } = await createAdminWithToken();
    await request(app)
      .post('/api/admin/create')
      .set('Authorization', `Bearer ${token}`)
      .send(newAdminPayload);

    // tenta criar de novo com o mesmo e-mail
    const res = await request(app)
      .post('/api/admin/create')
      .set('Authorization', `Bearer ${token}`)
      .send(newAdminPayload);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Email já cadastrado.');
  });

  it('deve retornar 400 se faltar campos obrigatórios', async () => {
     const { token } = await createAdminWithToken();
    const res = await request(app)
      .post('/api/admin/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'incompleto@test.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Dados inválidos');
    expect(res.body.details).toBeInstanceOf(Array);
  });

  // opcional, mas recomendado:
  it('deve retornar 401 sem token', async () => {
    const res = await request(app)
      .post('/api/admin/create')
      .send(newAdminPayload);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Não autorizado');
  });
});

  // =====================
  // APPROVE RIDER
  // =====================
  describe('PATCH /admin/riders/:id/approve', () => {
   
      it('deve retordar status 404 quando Rider não existir', async () => {
         const { token } = await createAdminWithToken();
         const fakeId = '64f1a2b3c4d5e6f7a8b9c0d1';
         const res = await request(app)
         .patch(`/api/admin/riders/${fakeId}/approve`)
         .set('Authorization', `Bearer ${token}`);
         expect(res.status).toBe(404);
         expect(res.body.error).toBe('Entregador não encontrado.');
      });
      it('deve retordar status 400 e não aprovar o rider quando a imagem do documento não tiver sido enviada', async () => {
           const { token } = await createAdminWithToken();
           const rider = await createRider({ documentImage: null });
           const res = await request(app)
           .patch(`/api/admin/riders/${rider._id}/approve`)
           .set('Authorization', `Bearer ${token}`);

           expect(res.status).toBe(400);
           expect(res.body.error).toBe('Documento ainda não enviado.');
      });
      it('deve retordar status 400 quando o Rider já tenha sido aprovado anteriormente', async () => {
         const { token } = await createAdminWithToken();
         const rider = await createRider({ accountApprovedAt: new Date(), documentImage: 'https://res.cloudinary.com/demo/image/upload/v1/delivroo/riders/rider_test.jpg' });
         const res = await request(app)
         .patch(`/api/admin/riders/${rider._id}/approve`)
         .set('Authorization', `Bearer ${token}`);

         expect(res.status).toBe(400);
         expect(res.body.error).toBe('Conta já aprovada.');
      });
      it('deve retordar status 200, enviar o email, e Rider data quando a conta for aprovada com sucesso', async () => {
         vi.spyOn(sendEmail, 'sendRiderAccountApprovedEmail').mockResolvedValue({});
         const { token } = await createAdminWithToken();
         const rider = await createRider({ accountApprovedAt: null, documentImage: 'https://res.cloudinary.com/demo/image/upload/v1/delivroo/riders/rider_test.jpg' });
         const res = await request(app)
         .patch(`/api/admin/riders/${rider._id}/approve`)
         .set('Authorization', `Bearer ${token}`);
     
          expect(sendEmail.sendRiderAccountApprovedEmail).toHaveBeenCalledWith(
                   res.body.rider.email,
                   expect.any(String)
                );
          expect(res.status).toBe(200);
          expect(res.body.message).toBe('Conta aprovada com sucesso.');
          expect(res.body.rider).toBeDefined();
          expect(res.body.rider.password).toBeUndefined(); //
      });
     it('deve retornar status 401 quando não autenticado (sem token)', async () => {
       const rider = await createRider({ accountApprovedAt: null, documentImage: 'https://res.cloudinary.com/demo/image/upload/v1/delivroo/riders/rider_test.jpg' });
        const res = await request(app)
         .patch(`/api/admin/riders/${rider._id}/approve`);
         expect(res.status).toBe(401);
     });
    
  });
  // =====================
  // ACTIVE / DEACTIVE RIDER
  // =====================
  describe('PATCH /admin/riders/:id/active', () => {
   
    it('deve retordar status 404 quando Rider não existir', async () => {
         const { token } = await createAdminWithToken();
         const fakeId = '64f1a2b3c4d5e6f7a8b9c0d1';
         const res = await request(app)
         .patch(`/api/admin/riders/${fakeId}/active`)
         .send({ active: true })
         .set('Authorization', `Bearer ${token}`);
         expect(res.status).toBe(404);
         expect(res.body.error).toBe('Entregador não encontrado.');
      });
     it('deve retornar status 401 quando não autenticado (sem token)', async () => {
        const fakeId = '64f1a2b3c4d5e6f7a8b9c0d1';
        const res = await request(app)
         .patch(`/api/admin/riders/${fakeId}/active`);
         expect(res.status).toBe(401);
     });
     it('deve retornar status 200 e ativar a conta quando payload active for true', async () => { 
         const { token } = await createAdminWithToken();
         const inactiveRider = await createRider({ active: false });

         const res = await request(app)
         .patch(`/api/admin/riders/${inactiveRider._id}/active`)
         .send({ active: true })
         .set('Authorization', `Bearer ${token}`);

         const updatedRider = await Rider.findById(inactiveRider._id);

         expect(updatedRider.active).toBe(true);
         expect(res.status).toBe(200);
         expect(res.body.message).toBe('Conta ativada com sucesso.');
      });
      it('deve retornar status 200 e desativar a conta quando payload active for false', async () => { 
         const { token } = await createAdminWithToken();
         const activeRider = await createRider({ active: true });

         const res = await request(app)
         .patch(`/api/admin/riders/${activeRider._id}/active`)
         .send({ active: false })
         .set('Authorization', `Bearer ${token}`);

         const updatedRider = await Rider.findById(activeRider._id);

         expect(updatedRider.active).toBe(false);
         expect(res.status).toBe(200);
         expect(res.body.message).toBe('Conta desativada com sucesso.');
      });
  });
   // =====================
  // ACTIVE / DEACTIVE STORE
  // =====================
  describe('PATCH /admin/stores/:id/active', () => {
     
    it('deve retordar status 404 quando Store não existir', async () => {
         const { token } = await createAdminWithToken();
         const fakeId = '64f1a2b3c4d5e6f7a8b9c0d1';
         const res = await request(app)
         .patch(`/api/admin/stores/${fakeId}/active`)
         .send({ active: true })
         .set('Authorization', `Bearer ${token}`);
         expect(res.status).toBe(404);
         expect(res.body.error).toBe('Loja não encontrada.');
      });
     it('deve retornar status 401 quando não autenticado (sem token)', async () => {
        const fakeId = '64f1a2b3c4d5e6f7a8b9c0d1';
        const res = await request(app)
         .patch(`/api/admin/stores/${fakeId}/active`);
         expect(res.status).toBe(401);
     });
     it('deve retornar status 200 e ativar a conta quando payload active for true', async () => { 
         const { token } = await createAdminWithToken();
         const inactiveStore = await createStore({ active: false });
         const res = await request(app)
         .patch(`/api/admin/stores/${inactiveStore._id}/active`)
         .send({ active: true })
         .set('Authorization', `Bearer ${token}`);

         const updatedStore = await Store.findById(inactiveStore._id);

         expect(updatedStore.active).toBe(true);
         expect(res.status).toBe(200);
         expect(res.body.message).toBe('Conta ativada com sucesso.');
      });
      it('deve retornar status 200 e desativar a conta quando payload active for false', async () => { 
         const { token } = await createAdminWithToken();
         const activeStore = await createStore({ active: true });
         const res = await request(app)
         .patch(`/api/admin/stores/${activeStore._id}/active`)
         .send({ active: false })
         .set('Authorization', `Bearer ${token}`);

         const updatedStore = await Store.findById(activeStore._id);

         expect(updatedStore.active).toBe(false);
         expect(res.status).toBe(200);
         expect(res.body.message).toBe('Conta desativada com sucesso.');
      });
  });
  // =====================
  // CREATE CITY
  // =====================
  describe('POST /api/admin/cities', () => {
    let newCityPayload = {}
    beforeEach(async () => {
      
       newCityPayload = {
          name: 'São Paulo',
          state: 'SP',  
          slug: 'sao-paulo-sp',
        };

    })
    
    

    it('deve retornar 401 quando não autenticado (sem token)', async () => {
        const res = await request(app).post('/api/admin/cities')
              .send(newCityPayload);
  
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Não autorizado');
    });
    it('deve retornar 401 quando token for inválido', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      const res = await request(app)
        .post('/api/admin/cities')
        .set('Authorization', `Bearer ${token}-invalido`)
        .send(newCityPayload);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });
    it('deve retornar 400 quando nome não for informado', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      delete newCityPayload.name;
      const res = await request(app)
        .post('/api/admin/cities')
        .set('Authorization', `Bearer ${token}`)
        .send(newCityPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Nome é obrigatório');
    });
    it('deve retornar 400 quando nome for inválido', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      newCityPayload.name = 'Sa';
      const res = await request(app)
        .post('/api/admin/cities')
        .set('Authorization', `Bearer ${token}`)
        .send(newCityPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Nome deve ter pelo menos 3 caracteres');
    });
    it('deve retornar 400 quando estado não for informado', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      delete newCityPayload.state;
      const res = await request(app)
        .post('/api/admin/cities')
        .set('Authorization', `Bearer ${token}`)
        .send(newCityPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Estado é obrigatório');
    });
    it('deve retornar 400 quando estado for inválido', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      newCityPayload.state = 'JJ';
      const res = await request(app)
        .post('/api/admin/cities')
        .set('Authorization', `Bearer ${token}`)
        .send(newCityPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Estado inválido');
    });
    it('deve retornar 400 quando slug não for informado', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      delete newCityPayload.slug;
      const res = await request(app)
        .post('/api/admin/cities')
        .set('Authorization', `Bearer ${token}`)
        .send(newCityPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Slug é obrigatório');
    });
    it('deve retornar 400 quando slug tiver menos de 6 caracteres', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      newCityPayload.slug = 'Ita';
      const res = await request(app)
        .post('/api/admin/cities')
        .set('Authorization', `Bearer ${token}`)
        .send(newCityPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Slug deve ter pelo menos 6 caracteres');
    });
    it('deve retornar 400 quando slug for inválido', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      newCityPayload.slug = 'sao-paulo-mg';
      const res = await request(app)
        .post('/api/admin/cities')
        .set('Authorization', `Bearer ${token}`)
        .send(newCityPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toContain('Slug inválido');
    });
    it('deve retornar 400 quando slug já existir', async () => {
       const { token } = await createAdminWithToken({ password: '123456' });
       await City.create({
             name: 'São Paulo',
             state: 'SP',
             slug: 'sao-paulo-sp',
        });
       const res = await request(app)
        .post('/api/admin/cities')
        .set('Authorization', `Bearer ${token}`)
        .send(newCityPayload);

         expect(res.status).toBe(400);
         expect(res.body.error).toBe('Já existe uma cidade com este slug.');
    });
    it('deve retornar 201 e cadastrar a cidade quando os dados forem válidos e o slug não existir', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
     
       const res = await request(app)
        .post('/api/admin/cities')
        .set('Authorization', `Bearer ${token}`)
        .send(newCityPayload);

         expect(res.status).toBe(201);
         expect(res.body.message).toBe('Cidade criada com sucesso.');
         expect(res.body.city).toBeDefined();
         expect(res.body.city.name).toBe(newCityPayload.name);
         expect(res.body.city.state).toBe(newCityPayload.state);
         expect(res.body.city.slug).toBe(newCityPayload.slug);
    });

    
  });

  // =====================
  // DASHBOARD
  // =====================
  describe('GET /api/admin/dashboard', () => {
    it('deve retornar 401 quando não autenticado (sem token)', async () => {
      const res = await request(app).get('/api/admin/dashboard');
      expect(res.status).toBe(401);
    });

    it('deve retornar as contagens corretas de riders, stores e entregas de hoje', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });

      // riders: 1 pendente, 1 ativo aprovado, 1 inativo
     await createRider({ accountApprovedAt: null });
     await createRider({ accountApprovedAt: new Date(), active: true });
     await createRider({ accountApprovedAt: new Date(), active: false });

      // stores: 1 ativa, 1 inativa
      await createStore({ active: true });
      await createStore({ active: false });

      // entregas de hoje: 1 concluída, 1 cancelada, 1 solicitada (status 0)
      const store = await createStore();
      const now = new Date();
      const d1 = await createDelivery({ store: store._id, status: 4 });
      await Delivery.findByIdAndUpdate(d1._id, { createdAt: now }, { overwriteImmutable: true });
      const d2 = await createDelivery({ store: store._id, status: 6 });
      await Delivery.findByIdAndUpdate(d2._id, { createdAt: now }, { overwriteImmutable: true });
      const d3 = await createDelivery({ store: store._id, status: 0 });
      await Delivery.findByIdAndUpdate(d3._id, { createdAt: now }, { overwriteImmutable: true });

      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.riders.pendingApproval).toBe(1);
      expect(res.body.riders.active).toBe(1);
      expect(res.body.riders.inactive).toBe(1);
      expect(res.body.riders.total).toBe(3);
      expect(res.body.stores.active).toBe(2); // a ativa + a criada pra entrega (createStore() default active:true)
      expect(res.body.stores.inactive).toBe(1);
      expect(res.body.deliveriesToday.requested).toBe(3);
      expect(res.body.deliveriesToday.completed).toBe(1);
      expect(res.body.deliveriesToday.cancelledOrReturned).toBe(1);
    });

    it('deve retornar tudo zerado quando não houver nenhum dado', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });

      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        riders: { total: 0, active: 0, inactive: 0, pendingApproval: 0 },
        stores: { total: 0, active: 0, inactive: 0 },
        deliveriesToday: { requested: 0, completed: 0, cancelledOrReturned: 0 },
      });
    });
  });

  // =====================
  // LIST RIDERS
  // =====================
  describe('GET /api/admin/riders', () => {
    it('deve retornar 401 quando não autenticado (sem token)', async () => {
      const res = await request(app).get('/api/admin/riders');
      expect(res.status).toBe(401);
    });

    it('deve listar todos os riders por padrão, paginado, ordenado do mais recente pro mais antigo', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      const r1 = await createRider({ name: 'Rider Antigo' });
      const r2 = await createRider({ name: 'Rider Recente' });

      const res = await request(app)
        .get('/api/admin/riders')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]._id).toBe(r2._id.toString());
      expect(res.body.data[1]._id).toBe(r1._id.toString());
      expect(res.body.total).toBe(2);
      expect(res.body.data[0].password).toBeUndefined();
    });

    it('deve filtrar por status=pending (accountApprovedAt null)', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      const pendente = await createRider({ accountApprovedAt: null });
      await createRider({ accountApprovedAt: new Date() });

      const res = await request(app)
        .get('/api/admin/riders?status=pending')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]._id).toBe(pendente._id.toString());
    });

    it('deve filtrar por status=active (aprovado e habilitado)', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      const ativo = await createRider({ accountApprovedAt: new Date(), active: true });
      await createRider({ accountApprovedAt: null }); // pendente, não deve aparecer
      await createRider({ accountApprovedAt: new Date(), active: false }); // desativado, não deve aparecer

      const res = await request(app)
        .get('/api/admin/riders?status=active')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]._id).toBe(ativo._id.toString());
    });

    it('deve filtrar por status=inactive', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      const inativo = await createRider({ active: false });
      await createRider({ active: true });

      const res = await request(app)
        .get('/api/admin/riders?status=inactive')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]._id).toBe(inativo._id.toString());
    });

    it('deve filtrar por cidade', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      const cidade = await createCity();
      const daCidade = await createRider({ city: cidade._id });
      await createRider(); // outra cidade (factory cria uma nova por padrão)

      const res = await request(app)
        .get(`/api/admin/riders?city=${cidade._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]._id).toBe(daCidade._id.toString());
    });

    it('deve buscar por nome ou email (case-insensitive)', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      const alvo = await createRider({ name: 'Carlos Andrade', email: 'carlos@test.com' });
      await createRider({ name: 'Fernanda Lima', email: 'fernanda@test.com' });

      const res = await request(app)
        .get('/api/admin/riders?search=carlos')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]._id).toBe(alvo._id.toString());
    });

    it('deve respeitar page/limit', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      for (let i = 0; i < 5; i++) await createRider();

      const res = await request(app)
        .get('/api/admin/riders?page=2&limit=2')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.page).toBe(2);
      expect(res.body.totalPages).toBe(3);
    });

    it('deve retornar 400 quando status for inválido', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });

      const res = await request(app)
        .get('/api/admin/riders?status=xyz')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });

  // =====================
  // GET RIDER
  // =====================
  describe('GET /api/admin/riders/:id', () => {
    it('deve retornar 401 quando não autenticado (sem token)', async () => {
      const rider = await createRider();
      const res = await request(app).get(`/api/admin/riders/${rider._id}`);
      expect(res.status).toBe(401);
    });

    it('deve retornar 404 quando o rider não existir', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      const rider = await createRider();
      await Rider.findByIdAndDelete(rider._id);

      const res = await request(app)
        .get(`/api/admin/riders/${rider._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('deve retornar 404 quando o id for inválido (CastError)', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });

      const res = await request(app)
        .get('/api/admin/riders/id-invalido')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('deve retornar 200 e os dados do rider, sem a senha, com a cidade populada', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      const rider = await createRider();

      const res = await request(app)
        .get(`/api/admin/riders/${rider._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body._id).toBe(rider._id.toString());
      expect(res.body.password).toBeUndefined();
      expect(res.body.city).toHaveProperty('name');
    });
  });

  // =====================
  // LIST STORES
  // =====================
  describe('GET /api/admin/stores', () => {
    it('deve retornar 401 quando não autenticado (sem token)', async () => {
      const res = await request(app).get('/api/admin/stores');
      expect(res.status).toBe(401);
    });

    it('deve listar todas as lojas por padrão, sem a senha', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      await createStore();
      await createStore();

      const res = await request(app)
        .get('/api/admin/stores')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].password).toBeUndefined();
    });

    it('deve filtrar por status=active e status=inactive', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      const ativa = await createStore({ active: true });
      await createStore({ active: false });

      const resAtivas = await request(app)
        .get('/api/admin/stores?status=active')
        .set('Authorization', `Bearer ${token}`);
      expect(resAtivas.body.data).toHaveLength(1);
      expect(resAtivas.body.data[0]._id).toBe(ativa._id.toString());

      const resInativas = await request(app)
        .get('/api/admin/stores?status=inactive')
        .set('Authorization', `Bearer ${token}`);
      expect(resInativas.body.data).toHaveLength(1);
      expect(resInativas.body.data[0]._id).not.toBe(ativa._id.toString());
    });

    it('deve buscar por nome ou email', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      const alvo = await createStore({ name: 'Pizzaria do Centro' });
      await createStore({ name: 'Lanchonete da Praça' });

      const res = await request(app)
        .get('/api/admin/stores?search=pizzaria')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]._id).toBe(alvo._id.toString());
    });
  });

  // =====================
  // GET STORE
  // =====================
  describe('GET /api/admin/stores/:id', () => {
    it('deve retornar 401 quando não autenticado (sem token)', async () => {
      const store = await createStore();
      const res = await request(app).get(`/api/admin/stores/${store._id}`);
      expect(res.status).toBe(401);
    });

    it('deve retornar 404 quando a loja não existir', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      const store = await createStore();
      await Store.findByIdAndDelete(store._id);

      const res = await request(app)
        .get(`/api/admin/stores/${store._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('deve retornar 200 e os dados da loja, sem a senha', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      const store = await createStore();

      const res = await request(app)
        .get(`/api/admin/stores/${store._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body._id).toBe(store._id.toString());
      expect(res.body.password).toBeUndefined();
    });
  });

  // =====================
  // LIST DELIVERIES (monitor da plataforma)
  // =====================
  describe('GET /api/admin/deliveries', () => {
    it('deve retornar 401 quando não autenticado (sem token)', async () => {
      const res = await request(app).get('/api/admin/deliveries');
      expect(res.status).toBe(401);
    });

    it('deve listar entregas de QUALQUER loja (monitor da plataforma inteira)', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      const rider = await createRider();
      // origem não é required no schema e a factory não seta por padrão
      // (só o createDelivery de verdade, no controller, sempre preenche a
      // partir do endereço da loja) — passamos explícito aqui pra simular
      // o formato real de uma entrega criada pelo fluxo normal.
      const origem = { address: 'Av. Central, 100 - Centro', latitude: -22.4739, longitude: -45.6097 };
      await createDelivery({ rider: rider._id, origem });
      await createDelivery({ origem });

      const res = await request(app)
        .get('/api/admin/deliveries')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      // O admin precisa de acesso total — dados de contato da loja e do
      // entregador vêm populados, não só o nome (ver getStore/getRider
      // pra revisão completa de cada conta separadamente).
      expect(res.body.data[0].store).toHaveProperty('name');
      expect(res.body.data[0].store).toHaveProperty('phone');
      expect(res.body.data[0].store).toHaveProperty('email');
      const comRider = res.body.data.find((d) => d.rider);
      expect(comRider.rider).toHaveProperty('phone');
      expect(comRider.rider).toHaveProperty('email');
      // endereço e eventos já vêm sempre, direto do próprio documento
      // (nunca foram cortados pelo endpoint — o gap era só no front)
      expect(res.body.data[0]).toHaveProperty('origem');
      expect(res.body.data[0]).toHaveProperty('destino');
      expect(res.body.data[0]).toHaveProperty('events');
      expect(res.body.data[0]).toHaveProperty('package');
    });

    it('deve filtrar por status', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      const entregue = await createDelivery({ status: 4 });
      await createDelivery({ status: 0 });

      const res = await request(app)
        .get('/api/admin/deliveries?status=4')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]._id).toBe(entregue._id.toString());
    });

    it('deve filtrar por loja', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      const store = await createStore();
      const daLoja = await createDelivery({ store: store._id });
      await createDelivery();

      const res = await request(app)
        .get(`/api/admin/deliveries?store=${store._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]._id).toBe(daLoja._id.toString());
    });

    it('deve filtrar por rider', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      const rider = await createRider();
      const doRider = await createDelivery({ rider: rider._id });
      await createDelivery();

      const res = await request(app)
        .get(`/api/admin/deliveries?rider=${rider._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]._id).toBe(doRider._id.toString());
    });

    it('deve filtrar por cidade', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      const cidade = await createCity();
      const daCidade = await createDelivery({ city: cidade._id });
      await createDelivery();

      const res = await request(app)
        .get(`/api/admin/deliveries?city=${cidade._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]._id).toBe(daCidade._id.toString());
    });

    it('deve retornar 400 quando status for inválido', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });

      const res = await request(app)
        .get('/api/admin/deliveries?status=99')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });

  // =====================
  // LIST CITIES
  // =====================
  describe('GET /api/admin/cities', () => {
    it('deve retornar 401 quando não autenticado (sem token)', async () => {
      const res = await request(app).get('/api/admin/cities');
      expect(res.status).toBe(401);
    });

    it('deve listar todas as cidades, ativas e inativas, ordenadas por nome', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });
      await createCity({ name: 'Zoológico City', slug: `zoo-${Date.now()}` });
      await createCity({ name: 'Alfaville', slug: `alfa-${Date.now()}`, active: false });

      const res = await request(app)
        .get('/api/admin/cities')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('Alfaville');
      expect(res.body[1].name).toBe('Zoológico City');
    });
  });

  // =====================
  // GET PLATFORM SETTINGS
  // =====================
  describe('GET /api/admin/platform-settings', () => {
    it('deve retornar 401 quando não autenticado (sem token)', async () => {
      const res = await request(app).get('/api/admin/platform-settings');
      expect(res.status).toBe(401);
    });

    it('deve criar e retornar as configurações padrão quando ainda não existirem', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });

      const res = await request(app)
        .get('/api/admin/platform-settings')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.deliveryFee).toBe(1.5);
      expect(res.body.freeDeliveriesPromoActive).toBe(true);
      expect(res.body.freeDeliveriesGranted).toBe(5);

      // E o documento singleton deve ter sido persistido no banco
      const settingsCount = await PlatformSettings.countDocuments();
      expect(settingsCount).toBe(1);
    });

    it('deve retornar as configurações já existentes, sem recriá-las', async () => {
      await PlatformSettings.create({ deliveryFee: 3, freeDeliveriesPromoActive: false, freeDeliveriesGranted: 8 });
      const { token } = await createAdminWithToken({ password: '123456' });

      const res = await request(app)
        .get('/api/admin/platform-settings')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.deliveryFee).toBe(3);
      expect(res.body.freeDeliveriesPromoActive).toBe(false);
      expect(res.body.freeDeliveriesGranted).toBe(8);

      const settingsCount = await PlatformSettings.countDocuments();
      expect(settingsCount).toBe(1);
    });
  });

  // =====================
  // UPDATE PLATFORM SETTINGS
  // =====================
  describe('PATCH /api/admin/platform-settings', () => {
    it('deve retornar 401 quando não autenticado (sem token)', async () => {
      const res = await request(app)
        .patch('/api/admin/platform-settings')
        .send({ deliveryFee: 2 });

      expect(res.status).toBe(401);
    });

    it('deve retornar 400 quando deliveryFee for negativo', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });

      const res = await request(app)
        .patch('/api/admin/platform-settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ deliveryFee: -1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].message).toBe('Taxa por entrega deve ser um número maior ou igual a 0');
    });

    it('deve retornar 400 quando freeDeliveriesPromoActive não for booleano', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });

      const res = await request(app)
        .patch('/api/admin/platform-settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ freeDeliveriesPromoActive: 'sim' });

      expect(res.status).toBe(400);
      expect(res.body.details[0].message).toBe('freeDeliveriesPromoActive deve ser um booleano');
    });

    it('deve retornar 400 quando freeDeliveriesGranted for negativo', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });

      const res = await request(app)
        .patch('/api/admin/platform-settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ freeDeliveriesGranted: -3 });

      expect(res.status).toBe(400);
      expect(res.body.details[0].message).toBe('Quantidade de entregas grátis deve ser um número inteiro maior ou igual a 0');
    });

    it('deve atualizar apenas deliveryFee, mantendo os demais campos inalterados', async () => {
      await PlatformSettings.create({ deliveryFee: 1.5, freeDeliveriesPromoActive: true, freeDeliveriesGranted: 5 });
      const { token } = await createAdminWithToken({ password: '123456' });

      const res = await request(app)
        .patch('/api/admin/platform-settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ deliveryFee: 2 });

      expect(res.status).toBe(200);
      expect(res.body.deliveryFee).toBe(2);
      expect(res.body.freeDeliveriesPromoActive).toBe(true);
      expect(res.body.freeDeliveriesGranted).toBe(5);
    });

    it('deve desativar a promoção de entregas grátis sem mexer na taxa vigente', async () => {
      await PlatformSettings.create({ deliveryFee: 1.5, freeDeliveriesPromoActive: true, freeDeliveriesGranted: 5 });
      const { token } = await createAdminWithToken({ password: '123456' });

      const res = await request(app)
        .patch('/api/admin/platform-settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ freeDeliveriesPromoActive: false });

      expect(res.status).toBe(200);
      expect(res.body.freeDeliveriesPromoActive).toBe(false);
      expect(res.body.deliveryFee).toBe(1.5);
    });

    it('deve atualizar todos os campos de uma vez e persistir as mudanças', async () => {
      await PlatformSettings.create({ deliveryFee: 1.5, freeDeliveriesPromoActive: true, freeDeliveriesGranted: 5 });
      const { token } = await createAdminWithToken({ password: '123456' });

      const patchRes = await request(app)
        .patch('/api/admin/platform-settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ deliveryFee: 2.75, freeDeliveriesPromoActive: false, freeDeliveriesGranted: 3 });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.deliveryFee).toBe(2.75);
      expect(patchRes.body.freeDeliveriesPromoActive).toBe(false);
      expect(patchRes.body.freeDeliveriesGranted).toBe(3);

      // Confirma que persistiu de fato, e não só na resposta
      const getRes = await request(app)
        .get('/api/admin/platform-settings')
        .set('Authorization', `Bearer ${token}`);

      expect(getRes.body.deliveryFee).toBe(2.75);
      expect(getRes.body.freeDeliveriesPromoActive).toBe(false);
      expect(getRes.body.freeDeliveriesGranted).toBe(3);
    });

    it('deve criar as configurações com os padrões antes de aplicar o patch, quando ainda não existirem', async () => {
      const { token } = await createAdminWithToken({ password: '123456' });

      const res = await request(app)
        .patch('/api/admin/platform-settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ deliveryFee: 4 });

      expect(res.status).toBe(200);
      expect(res.body.deliveryFee).toBe(4);
      // Campos não enviados devem ter vindo do padrão criado na hora
      expect(res.body.freeDeliveriesPromoActive).toBe(true);
      expect(res.body.freeDeliveriesGranted).toBe(5);
    });
  });
});