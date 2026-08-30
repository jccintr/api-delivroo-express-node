import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
//import Admin from '../models/admin.js';
import Rider from '../models/rider.js';
import Store from '../models/store.js';
import City from '../models/city.js';
//import bcryptjs from 'bcryptjs';
//import jsonwebtoken from 'jsonwebtoken';
import {createAdmin,createAdminWithToken,createStore} from './factories/admin.factory.js'
import {createStore} from './factories/store.factory.js'
import {createRider} from './factories/rider.factory.js'
import * as sendEmail from '../utils/sendEmailV2.js';

const adminPayload = {
  name: 'João Entregador',
  email: 'joao@test.com',
  password: '123456',
};

const riderPayload = {
  name: 'João Entregador',
  email: 'joao@test.com',
  password: '123456',
  phone: '11999999999',
  vehicle: { type: 'Moto' },
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
    
      let newRiderId;
      let approvedRiderId;
      beforeEach(async () => {
       
          const newRider = await Rider.create(riderPayload);

          const approvedRiderPayload = {
            name: 'Paulo Entregador',
            email: 'paulo@test.com',
            password: '123456',
            phone: '11999999999',
            vehicle: { type: 'Moto' },
            accountApprovedAt: new Date(),
            documentImage: 'https://res.cloudinary.com/demo/image/upload/v1/delivroo/riders/rider_test.jpg'
          };
          const approvedRider = await Rider.create(approvedRiderPayload);
          approvedRiderId = approvedRider._id;
          newRiderId = newRider._id;
         
      });
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
           const res = await request(app)
           .patch(`/api/admin/riders/${newRiderId}/approve`)
           .set('Authorization', `Bearer ${token}`);

           expect(res.status).toBe(400);
           expect(res.body.error).toBe('Documento ainda não enviado.');
      });
      it('deve retordar status 400 quando o Rider já tenha sido aprovado anteriormente', async () => {
         const { token } = await createAdminWithToken();
         const res = await request(app)
         .patch(`/api/admin/riders/${approvedRiderId}/approve`)
         .set('Authorization', `Bearer ${token}`);

         expect(res.status).toBe(400);
         expect(res.body.error).toBe('Conta já aprovada.');
      });
      it('deve retordar status 200, enviar o email, e Rider data quando a conta for aprovada com sucesso', async () => {
         vi.spyOn(sendEmail, 'sendRiderAccountApprovedEmail').mockResolvedValue({});
         const { token } = await createAdminWithToken();
         await Rider.findByIdAndUpdate(newRiderId, { documentImage: 'https://res.cloudinary.com/demo/image/upload/v1/delivroo/riders/rider_test.jpg' });
         const res = await request(app)
         .patch(`/api/admin/riders/${newRiderId}/approve`)
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
        const res = await request(app)
         .patch(`/api/admin/riders/${newRiderId}/approve`);
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
});