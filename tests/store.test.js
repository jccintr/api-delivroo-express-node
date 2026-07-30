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

  });
});