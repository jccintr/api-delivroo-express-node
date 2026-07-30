import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import Store from '../models/store.js';
import bcryptjs from 'bcryptjs';
import jsonwebtoken from 'jsonwebtoken';

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
    it('deve cadastrar uma loja com sucesso', async () => {
          const res = await request(app)
            .post('/api/stores/register')
            .send(storePayload);
    
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
});