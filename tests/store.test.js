import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import Store from '../models/store.js';
import bcryptjs from 'bcryptjs';
import jsonwebtoken from 'jsonwebtoken';
import * as sendEmail from '../utils/sendEmailV2.js';
import {createStore,createStoreWithToken} from './factories/store.factory.js'
import { createCity } from './factories/city.factory.js';

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
          const city = await createCity();
          storePayload.cityId = city._id;
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
          const city = await createCity();
          storePayload.cityId = city._id;
          await request(app).post('/api/stores/register').send(storePayload);
    
          const res = await request(app)
            .post('/api/stores/register')
            .send(storePayload);
    
          expect(res.status).toBe(400);
          expect(res.body.error).toBe('Email já cadastrado.');
        });
    
        it('deve retornar 400 se faltar campos obrigatórios', async () => {
          const city = await createCity();
          storePayload.cityId = city._id;
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
           const city = await createCity();
          
           await Store.create({
             name: storePayload.name,
             email: storePayload.email,
             password: hashedPassword,
             phone: storePayload.phone,
             city: city._id
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
        const city = await createCity();
       
        const store = await Store.create({
          name: storePayload.name,
          email: storePayload.email,
          password: hashedPassword,
          phone: storePayload.phone,
          city: city._id
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
    // Resend Account Verification Code (POST /verify-account/resend)
    // =====================
  describe('POST /api/stores/verify-account/resend', () => {
    it('deve retornar 401 quando não autenticado (sem token)', async () => {
      const res = await request(app).post('/api/stores/verify-account/resend');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });
    it('deve retornar 401 quando token for inválido', async () => {
      const {store,token} = await createStoreWithToken({ password: '123456' });
      const res = await request(app)
          .post('/api/stores/verify-account/resend')
          .set('Authorization', `Bearer ${token}-invalido`);
      
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });
    it('deve retornar 404 quando store não existir', async () => {
      const {store,token} = await createStoreWithToken({ password: '123456' });
      await Store.findByIdAndDelete(store._id);
      const res = await request(app)
          .post('/api/stores/verify-account/resend')
          .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Loja não encontrada.');
    });
    it('deve retornar 400 quando a conta já estiver verificada', async () => {
      const {store,token} = await createStoreWithToken({ password: '123456' });
      const validCode = '1234';
      await Store.findByIdAndUpdate(store._id, { emailVerificationCode: validCode, emailVerifiedAt: new Date() });
      const res = await request(app)
          .post('/api/stores/verify-account/resend')
          .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Conta já verificada.');
    });
      it('deve retornar 200, gerar um novo código de verificação e reenviar quando o store existir e não estiver verificado', async () => {
        const {store,token} = await createStoreWithToken({ password: '123456' });
        const oldCode = '1234';
        await Store.findByIdAndUpdate(store._id, { emailVerificationCode: oldCode });
        vi.spyOn(sendEmail, 'sendStoreVerificationAccountEmail').mockResolvedValue({});
        const res = await request(app)
          .post('/api/stores/verify-account/resend')
          .set('Authorization', `Bearer ${token}`);

        const updated = await Store.findById(store._id).select('emailVerificationCode');

        expect(res.status).toBe(200);
        expect(sendEmail.sendStoreVerificationAccountEmail).toHaveBeenCalledWith(
          store.email,
          expect.any(String)
        );
        expect(updated.emailVerificationCode).toBeTruthy();
        expect(updated.emailVerificationCode).not.toBe(oldCode);
        expect(updated.emailVerificationCode).toHaveLength(4);
        expect(res.body.message).toBe('Código de verificação reenviado.');
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
   // =====================
    // Verify Reset Password Code (POST /password/verify-code)
    // =====================
  describe('POST /api/stores/password/verify-code', () => {
      it('deve retornar 403 e resposta genérica quando email não existir', async () => {
        const store = await createStore({ password: '123456' });
        const code = '1234';
        const nonExistingEmail = 'fake@gmail.com';
        const res = await request(app)
          .post('/api/stores/password/verify-code')
          .send({email: nonExistingEmail, code: code});

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Código inválido ou expirado.');
      });
      it('deve retornar 403 e resposta genérica quando a conta estiver desativada', async () => {
          const store = await createStore({ password: '123456' });
          const code = '1234';
          await Store.findByIdAndUpdate(store._id, { active: false });
          const res = await request(app)
          .post('/api/stores/password/verify-code')
          .send({email: store.email,code: code});
        
          expect(res.status).toBe(403);
          expect(res.body.error).toBe('Código inválido ou expirado.');
      });
      it('deve retornar 403 e resposta genérica quando o código estiver expirado', async () => {
          const store = await createStore({ password: '123456' });
          const code = '1234';
          const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hora atrás
          await Store.findByIdAndUpdate(store._id, { resetPasswordCodeExpiresAt: pastDate });
          const res = await request(app)
          .post('/api/stores/password/verify-code')
          .send({email: store.email, code: code});
        
          expect(res.status).toBe(403);
          expect(res.body.error).toBe('Código inválido ou expirado.');
      });
      it('deve retornar 403 e resposta genérica quando o código de recuperação não tiver sido gerado', async () => {
          const store = await createStore({ password: '123456' });
          const code = '1234';
          await Store.findByIdAndUpdate(store._id, { resetPasswordCode: null, resetPasswordCodeExpiresAt: null });
          const res = await request(app)
          .post('/api/stores/password/verify-code')
          .send({email: store.email, code: code});
        
          expect(res.status).toBe(403);
          expect(res.body.error).toBe('Código inválido ou expirado.');
      });
      it('deve retornar 403 e resposta genérica quando o código for inválido', async () => {
          const store = await createStore({ password: '123456' });
          const invalidCode = '0000';
          await Store.findByIdAndUpdate(store._id, { resetPasswordCode: null, resetPasswordCodeExpiresAt: null });
          const res = await request(app)
          .post('/api/stores/password/verify-code')
          .send({email: store.email, code: invalidCode});
        
          expect(res.status).toBe(403);
          expect(res.body.error).toBe('Código inválido ou expirado.');
      });
      it('deve retornar 200 e resposta de sucesso quando o código for válido', async () => {
          const store = await createStore({ password: '123456' });
          const validCode = '9462';
          await Store.findByIdAndUpdate(store._id, { resetPasswordCode: validCode, resetPasswordCodeExpiresAt:  new Date(Date.now() + 15 * 60 * 1000) });
          const res = await request(app)
          .post('/api/stores/password/verify-code')
          .send({email: store.email, code: validCode});
        
          expect(res.status).toBe(200);
          expect(res.body.message).toBe('Código verificado com sucesso.');
      });

  });
   // =====================
    // Reset Password (POST /password/reset)
    // =====================
  describe('POST /api/stores/password/reset', () => {
      it('deve retornar 403 e resposta genérica quando email não existir', async () => {
        const store = await createStore({ password: '123456' });
        const code = '1234';
        const nonExistingEmail = 'fake@gmail.com';
        const res = await request(app)
          .post('/api/stores/password/reset')
          .send({email: nonExistingEmail, code: code, password: 'novaSenha123'});

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Código inválido ou expirado.');
      });
      it('deve retornar 403 e resposta genérica quando a conta estiver desativada', async () => {
          const store = await createStore({ password: '123456' });
          const code = '1234';
          await Store.findByIdAndUpdate(store._id, { active: false });
          const res = await request(app)
          .post('/api/stores/password/reset')
          .send({email: store.email,code: code, password: 'novaSenha123'});
        
          expect(res.status).toBe(403);
          expect(res.body.error).toBe('Código inválido ou expirado.');
      });
      it('deve retornar 403 e resposta genérica quando o código estiver expirado', async () => {
          const store = await createStore({ password: '123456' });
          const code = '1234';
          const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hora atrás
          await Store.findByIdAndUpdate(store._id, { resetPasswordCodeExpiresAt: pastDate });
          const res = await request(app)
          .post('/api/stores/password/reset')
          .send({email: store.email, code: code, password: 'novaSenha123'});
        
          expect(res.status).toBe(403);
          expect(res.body.error).toBe('Código inválido ou expirado.');
      });
      it('deve retornar 403 e resposta genérica quando o código de recuperação não tiver sido gerado', async () => {
          const store = await createStore({ password: '123456' });
          const code = '1234';
          await Store.findByIdAndUpdate(store._id, { resetPasswordCode: null, resetPasswordCodeExpiresAt: null });
          const res = await request(app)
          .post('/api/stores/password/reset')
          .send({email: store.email, code: code, password: 'novaSenha123'});
        
          expect(res.status).toBe(403);
          expect(res.body.error).toBe('Código inválido ou expirado.');
      });
      it('deve retornar 403 e resposta genérica quando o código for inválido', async () => {
          const store = await createStore({ password: '123456' });
          const invalidCode = '0000';
          await Store.findByIdAndUpdate(store._id, { resetPasswordCode: null, resetPasswordCodeExpiresAt: null });
          const res = await request(app)
          .post('/api/stores/password/reset')
          .send({email: store.email, code: invalidCode, password: 'novaSenha123'});
        
          expect(res.status).toBe(403);
          expect(res.body.error).toBe('Código inválido ou expirado.');
      });
      it('deve retornar 200, atualizar a senha e invalidar o código quando o código for válido', async () => {
          const store = await createStore({ password: '123456' });
          const validCode = '9462';
          const newPassword = 'novaSenha123';

          await Store.findByIdAndUpdate(store._id, {
            resetPasswordCode: validCode,
            resetPasswordCodeExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
          });

          const res = await request(app)
            .post('/api/stores/password/reset')
            .send({
              email: store.email,
              code: validCode,
              password: newPassword,
            });

          expect(res.status).toBe(200);
          expect(res.body.message).toBe('Senha redefinida com sucesso.');

          const updated = await Store.findById(store._id).select(
            'password resetPasswordCode resetPasswordCodeExpiresAt'
          );

          // Senha realmente atualizada
          const isMatch = await bcryptjs.compare(newPassword, updated.password);
          expect(isMatch).toBe(true);

          // Código invalidado
          expect(updated.resetPasswordCode).toBeNull();
          expect(updated.resetPasswordCodeExpiresAt).toBeNull();
        });
  });
   // =====================
    // Update Profile (PATCH /me)
    // =====================
    describe('PATCH /api/stores/me', () => {
      it('deve retornar 401 quando não autenticado (sem token)', async () => {
        const res = await request(app).patch('/api/stores/me');
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Não autorizado');
      });
      it('deve retornar 404 quando store não existir', async () => {
        const { store,token } = await createStoreWithToken();
        await Store.findByIdAndDelete(store._id);
        const res = await request(app)
          .patch('/api/stores/me')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'John Doe',phone: '1234567890' ,doc: '1234567890' });
  
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Loja não encontrada.');
      });
      it('deve retornar 403 quando a conta estiver não estiver verificada', async () => {
        const { store,token } = await createStoreWithToken();
       
        const res = await request(app)
          .patch('/api/stores/me')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'John Doe',phone: '3534567890' ,doc: '1234567890' });
  
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Conta ainda não verificada.');
      });
      
      it('deve retornar 403 quando a conta estiver desativada', async () => {
        const { store,token } = await createStoreWithToken();
        await Store.findByIdAndUpdate(store._id, { active: false, emailVerifiedAt: new Date() });
        const res = await request(app)
          .patch('/api/stores/me')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'John Doe',phone: '3534567890' ,doc: '1234567890' });
  
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Conta desativada.');
      });
      it('deve retornar 400 quando nome tiver menos do que 3 caractres', async () => {
        const { store,token } = await createStoreWithToken();
        const res = await request(app)
          .patch('/api/stores/me')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Jo',phone: '1234567890' ,doc: '1234567890' });
  
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Dados inválidos');
        expect(res.body.details).toBeInstanceOf(Array);
        expect(res.body.details[0].message).toBe('Nome deve ter pelo menos 3 caracteres.');
      });
      it('deve retornar 400 quando o estado for inválido', async () => {
        const { store,token } = await createStoreWithToken();
        const res = await request(app)
          .patch('/api/stores/me')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Cesar Burg',phone: '1234567890' ,doc: '1234567890', address: { state: 'XX' } });
  
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Dados inválidos');
        expect(res.body.details).toBeInstanceOf(Array);
        expect(res.body.details[0].message).toBe('Estado inválido.');
      });
      
      it('deve retornar 400 quando phone estiver em branco', async () => {
        const { store,token } = await createStoreWithToken();
        const res = await request(app)
          .patch('/api/stores/me')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'John Doe',phone: '' ,doc: '1234567890' });
  
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Dados inválidos');
        expect(res.body.details).toBeInstanceOf(Array);
        expect(res.body.details[0].message).toBe('Telefone inválido.');
      });
      it('deve retornar 200, atualizar a loja e retornar a loja atualizada quando a loja existir, estiver validada e os dados forem validos', async () => { 
      const { store,token } = await createStoreWithToken({emailVerifiedAt: new Date() });
      
      const res = await request(app)
        .patch('/api/stores/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'John Doe',phone: '3534567890' ,doc: '1234567890', address: { state: 'SP' } });
      const updated = await Store.findById(store._id);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe(updated.name);
      expect(res.body.phone).toBe(updated.phone);
      expect(res.body.doc).toBe(updated.doc);
      expect(res.body.address.state).toBe(updated.address.state);
      expect(res.body.emailVerificationCode).toBeUndefined();
      expect(res.body.resetPasswordCode).toBeUndefined();
      expect(res.body.password).toBeUndefined();
      });
      
    });
});