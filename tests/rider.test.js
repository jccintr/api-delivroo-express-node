import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import Rider from '../models/rider.js';
import bcryptjs from 'bcryptjs';
import jsonwebtoken from 'jsonwebtoken';

const riderPayload = {
  name: 'João Entregador',
  email: 'joao@test.com',
  password: '123456',
  phone: '11999999999',
  vehicleType: 'Moto',
};

describe('Rider API', () => {
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
      expect(res.body.rider.password).toBeUndefined(); // senha não deve voltar
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
    beforeEach(async () => {
      // cria rider direto no banco para os testes de login
      const salt = await bcryptjs.genSalt(10);
      const hashedPassword = await bcryptjs.hash(riderPayload.password, salt);

      await Rider.create({
        name: riderPayload.name,
        email: riderPayload.email,
        password: hashedPassword,
        phone: riderPayload.phone,
        vehicle: { type: 'Moto' },
      });
    });

    it('deve fazer login com sucesso e retornar token', async () => {
      const res = await request(app)
        .post('/api/riders/login')
        .send({
          email: riderPayload.email,
          password: riderPayload.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.email).toBe(riderPayload.email);
      expect(res.body.password).toBeUndefined();
    });

    it('deve retornar 400 com senha incorreta', async () => {
      const res = await request(app)
        .post('/api/riders/login')
        .send({
          email: riderPayload.email,
          password: 'senha-errada',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email ou senha inválidos.');
    });

    it('deve retornar 400 com email inexistente', async () => {
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
      await Rider.updateOne({ email: riderPayload.email }, { active: false });

      const res = await request(app)
        .post('/api/riders/login')
        .send({
          email: riderPayload.email,
          password: riderPayload.password,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Conta desativada.');
    });
  });

  // =====================
  // VALIDATE TOKEN (GET /me)
  // =====================
  describe('GET /api/riders/me', () => {
    let token;
    let riderId;

    beforeEach(async () => {
      const salt = await bcryptjs.genSalt(10);
      const hashedPassword = await bcryptjs.hash(riderPayload.password, salt);

      const rider = await Rider.create({
        name: riderPayload.name,
        email: riderPayload.email,
        password: hashedPassword,
        phone: riderPayload.phone,
        vehicle: { type: 'Moto' },
      });

      riderId = rider._id;
      token = jsonwebtoken.sign(
        { riderId: rider._id },
        process.env.JWT_SECRET_RIDER
      );
    });

    it('deve retornar os dados do rider autenticado', async () => {
      const res = await request(app)
        .get('/api/riders/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe(riderPayload.email);
      expect(res.body.name).toBe(riderPayload.name);
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
      await Rider.findByIdAndUpdate(riderId, { active: false });

      const res = await request(app)
        .get('/api/riders/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Conta desativada.');
    });
  });
});