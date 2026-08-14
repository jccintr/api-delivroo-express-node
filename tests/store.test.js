import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import Store from '../models/store.js';
import bcryptjs from 'bcryptjs';
import jsonwebtoken from 'jsonwebtoken';
import * as sendEmail from '../utils/sendEmailV2.js';
import {createStore,createStoreWithToken} from './factories/store.factory.js'

const storePayload = {
  name: 'Pizzaria Alegria',
  email: 'alegria@test.com',
  password: '123456',
  phone: '11999999999',
};

describe('Store Routes', () => {
  // =====================
  // REGISTER
  // =====================
  describe('POST /api/stores/register', () => {
    it('deve cadastrar uma loja com sucesso, gerar um código de verificação e enviar por email', async () => {
           vi.spyOn(sendEmail, 'sendStoreVerificationAccountEmail').mockResolvedValue({});
          const res = await request(app)
            .post('/api/stores/register')
            .send(storePayload);
    
           expect(sendEmail.sendStoreVerificationAccountEmail).toHaveBeenCalledWith(
                    storePayload.email,
                    expect.any(String)
           );
          expect(res.status).toBe(201);
          expect(res.body.message).toBe('Conta criada com sucesso.');
          expect(res.body.store).toBeDefined();
          expect(res.body.store.email).toBe(storePayload.email);
          expect(res.body.store.password).toBeUndefined(); 
        });
    
        it('deve retornar 400 se o email já existir', async () => {
          await request(app).post('/api/stores/register').send(storePayload);
    
          const res = await request(app)
            .post('/api/stores/register')
            .send(storePayload);
    
          expect(res.status).toBe(400);
          expect(res.body.error).toBe('Email já cadastrado.');
        });
    
        it('deve retornar 400 se faltar campos obrigatórios', async () => {
          const res = await request(app)
            .post('/api/stores/register')
            .send({ email: 'incompleto@test.com' });
    
          expect(res.status).toBe(400);
          expect(res.body.error).toBe('Dados inválidos');
          expect(res.body.details).toBeInstanceOf(Array);
        });

  });
  // =====================
  // LOGIN
  // =====================
  describe('POST /api/stores/login', () => {
      beforeEach(async () => {
           const salt = await bcryptjs.genSalt(10);
           const hashedPassword = await bcryptjs.hash(storePayload.password, salt);
     
           await Store.create({
             name: storePayload.name,
             email: storePayload.email,
             password: hashedPassword,
             phone: storePayload.phone,
           });
      });
      it('deve fazer login com sucesso e retornar token', async () => {
        const res = await request(app)
          .post('/api/stores/login')
          .send({
            email: storePayload.email,
            password: storePayload.password,
          });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.email).toBe(storePayload.email);
        expect(res.body.password).toBeUndefined();
      });
      it('deve retornar 400 com senha incorreta', async () => {
            const res = await request(app)
              .post('/api/stores/login')
              .send({
                email: storePayload.email,
                password: 'senha-errada',
              });
      
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Email ou senha inválidos.');
      });
      it('deve retornar 400 com email inexistente', async () => {
            const res = await request(app)
              .post('/api/stores/login')
              .send({
                email: 'naoexiste@test.com',
                password: '123456',
              });
      
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Email ou senha inválidos.');
       });
       it('deve retornar 403 se a conta estiver desativada', async () => {
          await Store.updateOne({ email: storePayload.email }, { active: false });

          const res = await request(app)
            .post('/api/stores/login')
            .send({
              email: storePayload.email,
              password: storePayload.password,
            });

          expect(res.status).toBe(403);
          expect(res.body.error).toBe('Conta desativada.');
       });
  });
   // =====================
  // VALIDATE TOKEN (GET /me)
  // =====================
   describe('GET /api/stores/me', () => {
     let token;
     let storeId;
    
     beforeEach(async () => {
        const salt = await bcryptjs.genSalt(10);
        const hashedPassword = await bcryptjs.hash(storePayload.password, salt);

        const store = await Store.create({
          name: storePayload.name,
          email: storePayload.email,
          password: hashedPassword,
          phone: storePayload.phone,
        });

        storeId = store._id;
        token = jsonwebtoken.sign(
          { storeId: store._id },
          process.env.JWT_SECRET_STORE
        );
     });
      it('deve retornar os dados da loja autenticada', async () => {
           const res = await request(app)
             .get('/api/stores/me')
             .set('Authorization', `Bearer ${token}`);
     
           expect(res.status).toBe(200);
           expect(res.body.email).toBe(storePayload.email);
           expect(res.body.name).toBe(storePayload.name);
           expect(res.body.password).toBeUndefined();
      });
      it('deve retornar 401 sem token', async () => {
          const res = await request(app).get('/api/stores/me');
    
          expect(res.status).toBe(401);
          expect(res.body.error).toBe('Não autorizado');
      });
      it('deve retornar 401 com token inválido', async () => {
            const res = await request(app)
              .get('/api/stores/me')
              .set('Authorization', 'Bearer token-invalido');
      
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Não autorizado');
      });
      it('deve retornar 403 se a conta estiver desativada', async () => {
        await Store.findByIdAndUpdate(storeId, { active: false });

        const res = await request(app)
          .get('/api/stores/me')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Conta desativada.');
     });

   });
  // =====================
  // Verify Account (POST /verify-account)
  // =====================
  describe('POST /api/stores/verify-account', () => {
  
      it('deve retornar 401 quando não autenticado (sem token)', async () => {
        const res = await request(app).post('/api/stores/verify-account');
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Não autorizado');
      });
      it('deve retornar 401 quando token for inválido', async () => {
        const {store,token} = await createStoreWithToken({ password: '123456' });
        const res = await request(app)
           .post('/api/stores/verify-account')
           .set('Authorization', `Bearer ${token}-invalido`)
           .send({code: '1234'});
  
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Não autorizado');
      });
      it('deve retornar status 200, verificar a conta quando o código for válido e enviar email de confirmação a Store', async () => {
        const {store,token} = await createStoreWithToken({ password: '123456' });
        const validCode = '1234';
        await Store.findByIdAndUpdate(store._id, { emailVerificationCode: validCode });
        vi.spyOn(sendEmail, 'sendStoreAccountVerifiedEmail').mockResolvedValue({});
        const res = await request(app)
           .post('/api/stores/verify-account')
           .set('Authorization', `Bearer ${token}`)
           .send({code: validCode});
  
        expect(sendEmail.sendStoreAccountVerifiedEmail).toHaveBeenCalledWith(store.email);
        expect(res.status).toBe(200);
        expect(res.body.emailVerificationCode).toBeNull();
        expect(res.body.emailVerifiedAt).not.toBeNull();
        
      });
      it('deve retornar status 403 quando o código for inválido', async () => {
        const {store,token} = await createStoreWithToken({ password: '123456' });
        const validCode = '1234';
        await Store.findByIdAndUpdate(store._id, { emailVerificationCode: validCode });
        const res = await request(app)
           .post('/api/stores/verify-account')
           .set('Authorization', `Bearer ${token}`)
           .send({code: '0000'});
  
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Código de verificação inválido.');
      });
      it('deve retornar status 400 quando a conta já estiver verificada', async () => {
        const {store,token} = await createStoreWithToken({ password: '123456' });
        const validCode = '1234';
        await Store.findByIdAndUpdate(store._id, { emailVerificationCode: validCode, emailVerifiedAt: new Date() });
        const res = await request(app)
           .post('/api/stores/verify-account')
           .set('Authorization', `Bearer ${token}`)
           .send({code: validCode});
  
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Conta já verificada.');
      });
  
  });
  // =====================
  // Request Reset Password Code (POST /password/request)
  // =====================
   describe('POST /api/stores/password/request', () => {
       it('deve retornar 200 e resposta genérica quando email não existir', async () => {
            const store = await createStore({ password: '123456' });
            const nonExistingEmail = 'fake@gmail.com';
            const res = await request(app)
              .post('/api/stores/password/request')
              .send({email: nonExistingEmail});
  
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Se este e-mail estiver cadastrado, enviaremos um código de verificação.');
        });
      it('deve retornar 200 e resposta genérica quando quando a conta estiver desativada', async () => {
             const store = await createStore({ password: '123456' });
            
             await Store.findByIdAndUpdate(store._id, { active: false });
             const res = await request(app)
              .post('/api/stores/password/request')
              .send({email: store.email});
  
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Se este e-mail estiver cadastrado, enviaremos um código de verificação.');
      });
       it('deve retornar 200, resposta genérica, gerar um novo código com prazo de expiração e enviar o email quando quando o email existir e a conta estiver ativada', async () => {
           const store = await createStore({ password: '123456' });
           vi.spyOn(sendEmail, 'sendStorePasswordResetEmail').mockResolvedValue({});
           const res = await request(app)
              .post('/api/stores/password/request')
              .send({email: store.email});
  
          const updated = await Store.findById(store._id).select('resetPasswordCode resetPasswordCodeExpiresAt');
  
            expect(res.status).toBe(200);
            expect(updated.resetPasswordCode).toBeTruthy();
            expect(updated.resetPasswordCodeExpiresAt).toBeTruthy();
            expect(sendEmail.sendStorePasswordResetEmail).toHaveBeenCalledWith(
              store.email,
              expect.any(String)
            );
            expect(res.body.message).toBe('Se este e-mail estiver cadastrado, enviaremos um código de verificação.');
       });
    });
});