import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import Rider from '../models/rider.js';
import bcryptjs from 'bcryptjs';
import jsonwebtoken from 'jsonwebtoken';
import {createRider,createRiderWithToken} from './factories/rider.factory.js'

const riderPayload = {
  name: 'João Entregador',
  email: 'joao@test.com',
  password: '123456',
  phone: '11999999999',
  vehicleType: 'Moto',
};

describe('Rider Routes', () => {
  // =====================
  // REGISTER
  // =====================
  describe('POST /api/riders/register', () => {
    it('deve cadastrar um rider com sucesso', async () => {
      const res = await request(app)
        .post('/api/riders/register')
        .send(riderPayload);

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Conta criada com sucesso.');
      expect(res.body.rider).toBeDefined();
      expect(res.body.rider.email).toBe(riderPayload.email);
      expect(res.body.rider.emailVerifiedAt).toBeNull();
      expect(res.body.rider.emailVerificationCode).toBeUndefined(); // este campo não deve ser enviado
      expect(res.body.rider.resetPasswordCode).toBeUndefined(); // este campo não deve ser enviado
      expect(res.body.rider.password).toBeUndefined(); // este campo não deve ser enviado
    });

    it('deve retornar 400 se o email já existir', async () => {
      await request(app).post('/api/riders/register').send(riderPayload);

      const res = await request(app)
        .post('/api/riders/register')
        .send(riderPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email já cadastrado.');
    });

    it('deve retornar 400 se faltar campos obrigatórios', async () => {
      const res = await request(app)
        .post('/api/riders/register')
        .send({ email: 'incompleto@test.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details).toBeInstanceOf(Array);
    });

    it('deve retornar 400 se vehicleType for inválido', async () => {
      const res = await request(app)
        .post('/api/riders/register')
        .send({ ...riderPayload, vehicleType: 'Avião' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
    });
  });

  // =====================
  // LOGIN
  // =====================
  describe('POST /api/riders/login', () => {
    
    it('deve fazer login com sucesso e retornar token', async () => {
      const rider = await createRider({ password: '123456' });
      const res = await request(app)
        .post('/api/riders/login')
        .send({
          email: rider.email,
          password: '123456',
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.email).toBe(rider.email);
      expect(res.body.emailVerificationCode).toBeUndefined(); // este campo não deve ser enviado
      expect(res.body.resetPasswordCode).toBeUndefined(); // este campo não deve ser enviado
      expect(res.body.password).toBeUndefined();  // este campo não deve ser enviado
    });

    it('deve retornar 400 com senha incorreta', async () => {
      const rider = await createRider({ password: '123456' });
      const res = await request(app)
        .post('/api/riders/login')
        .send({
          email: rider.email,
          password: 'senha-errada',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email ou senha inválidos.');
    });

    it('deve retornar 400 com email inexistente', async () => {
      const rider = await createRider({ password: '123456' });
      const res = await request(app)
        .post('/api/riders/login')
        .send({
          email: 'naoexiste@test.com',
          password: '123456',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email ou senha inválidos.');
    });

   
    it('deve retornar 403 se a conta estiver desativada', async () => {
      const rider = await createRider({ password: '123456' });
      await Rider.updateOne({ email: rider.email }, { active: false });

      const res = await request(app)
        .post('/api/riders/login')
        .send({
          email: rider.email,
          password: '123456',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Conta desativada.');
    });
  });

  // =====================
  // VALIDATE TOKEN (GET /me)
  // =====================
  describe('GET /api/riders/me', () => {
   
    it('deve retornar status 200 e os dados do rider autenticado', async () => {
      const {rider,token} = await createRiderWithToken({ password: '123456' });
      const res = await request(app)
        .get('/api/riders/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe(rider.email);
      expect(res.body.name).toBe(rider.name);
      expect(res.body.emailVerificationCode).toBeUndefined();
      expect(res.body.resetPasswordCode).toBeUndefined();
      expect(res.body.password).toBeUndefined();
    });

    it('deve retornar 401 sem token', async () => {
      const res = await request(app).get('/api/riders/me');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });

    it('deve retornar 401 com token inválido', async () => {
      const res = await request(app)
        .get('/api/riders/me')
        .set('Authorization', 'Bearer token-invalido');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });

    it('deve retornar 403 se a conta estiver desativada', async () => {
      const {rider,token} = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndUpdate(rider._id, { active: false });

      const res = await request(app)
        .get('/api/riders/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Conta desativada.');
    });
  });
  // =====================
  // Verify Account (POST /verify-account)
  // =====================
   describe('POST /api/riders/verify-account', () => {

    it('deve retornar 401 quando não autenticado (sem token)', async () => {
      const res = await request(app).post('/api/riders/verify-account');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });
    it('deve retornar 401 quando token for inválido', async () => {
      const {rider,token} = await createRiderWithToken({ password: '123456' });
      const res = await request(app)
         .post('/api/riders/verify-account')
         .set('Authorization', `Bearer ${token}-invalido`)
         .send({code: '1234'});

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });
    it('deve retornar status 200 e verificar a conta quando o código for válido', async () => {
      const {rider,token} = await createRiderWithToken({ password: '123456' });
      const validCode = '1234';
      await Rider.findByIdAndUpdate(rider._id, { emailVerificationCode: validCode });
      const res = await request(app)
         .post('/api/riders/verify-account')
         .set('Authorization', `Bearer ${token}`)
         .send({code: validCode});

      expect(res.status).toBe(200);
      expect(res.body.emailVerificationCode).toBeNull();
      expect(res.body.emailVerifiedAt).not.toBeNull();
      
    });
    it('deve retornar status 403 quando o código for inválido', async () => {
      const {rider,token} = await createRiderWithToken({ password: '123456' });
      const validCode = '1234';
      await Rider.findByIdAndUpdate(rider._id, { emailVerificationCode: validCode });
      const res = await request(app)
         .post('/api/riders/verify-account')
         .set('Authorization', `Bearer ${token}`)
         .send({code: '0000'});

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Código de verificação inválido.');
    });
    it('deve retornar status 400 quando a conta já estiver verificada', async () => {
      const {rider,token} = await createRiderWithToken({ password: '123456' });
      const validCode = '1234';
      await Rider.findByIdAndUpdate(rider._id, { emailVerificationCode: validCode, emailVerifiedAt: new Date() });
      const res = await request(app)
         .post('/api/riders/verify-account')
         .set('Authorization', `Bearer ${token}`)
         .send({code: validCode});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Conta já verificada.');
    });

   });
  // =====================
  // Resend Account Verification Code (POST /verify-account/resend)
  // =====================
  describe('POST /api/riders/verify-account/resend', () => {
    it('deve retornar 401 quando não autenticado (sem token)', async () => {
      const res = await request(app).post('/api/riders/verify-account/resend');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });
    it('deve retornar 401 quando token for inválido', async () => {
      const {rider,token} = await createRiderWithToken({ password: '123456' });
      const res = await request(app)
         .post('/api/riders/verify-account/resend')
         .set('Authorization', `Bearer ${token}-invalido`);
     
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Não autorizado');
    });
    it('deve retornar 404 quando rider não existir', async () => {
      const {rider,token} = await createRiderWithToken({ password: '123456' });
      await Rider.findByIdAndDelete(rider._id);
      const res = await request(app)
         .post('/api/riders/verify-account/resend')
         .set('Authorization', `Bearer ${token}`);
     
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Rider não encontrado.');
    });
    it('deve retornar 400 quando a conta já estiver verificada', async () => {
      const {rider,token} = await createRiderWithToken({ password: '123456' });
      const validCode = '1234';
      await Rider.findByIdAndUpdate(rider._id, { emailVerificationCode: validCode, emailVerifiedAt: new Date() });
      const res = await request(app)
         .post('/api/riders/verify-account/resend')
         .set('Authorization', `Bearer ${token}`);
     
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Conta já verificada.');
    });
     it('deve retornar 200 e reenviar o código de verificação quando o rider existir e não estiver verificado', async () => {
       const {rider,token} = await createRiderWithToken({ password: '123456' });
       const validCode = '1234';
       await Rider.findByIdAndUpdate(rider._id, { emailVerificationCode: validCode });
       const res = await request(app)
         .post('/api/riders/verify-account/resend')
         .set('Authorization', `Bearer ${token}`);
     
       expect(res.status).toBe(200);
       expect(res.body.message).toBe('Código de verificação reenviado.');
     });

  });
});