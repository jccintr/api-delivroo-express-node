import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import Admin from '../models/admin.js';
import bcryptjs from 'bcryptjs';
import jsonwebtoken from 'jsonwebtoken';

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
    beforeEach(async () => {
      // cria admin direto no banco para os testes de login
      const salt = await bcryptjs.genSalt(10);
      const hashedPassword = await bcryptjs.hash(adminPayload.password, salt);

      await Admin.create({
        name: adminPayload.name,
        email: adminPayload.email,
        password: hashedPassword,
      });
    });

    it('deve fazer login com sucesso e retornar token', async () => {
      const res = await request(app)
        .post('/api/admin/login')
        .send({
          email: adminPayload.email,
          password: adminPayload.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.email).toBe(adminPayload.email);
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
      await Admin.updateOne({ email: adminPayload.email }, { active: false });

      const res = await request(app)
        .post('/api/admin/login')
        .send({
          email: adminPayload.email,
          password: adminPayload.password,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Conta desativada.');
    });
  });

  // =====================
  // VALIDATE TOKEN (GET /me)
  // =====================
  describe('GET /api/admin/me', () => {
    let token;
    let adminId;

    beforeEach(async () => {
      const salt = await bcryptjs.genSalt(10);
      const hashedPassword = await bcryptjs.hash(adminPayload.password, salt);

      const admin = await Admin.create({
        name: adminPayload.name,
        email: adminPayload.email,
        password: hashedPassword,
      });

      adminId = admin._id;
      token = jsonwebtoken.sign(
        { adminId: admin._id },
        process.env.JWT_SECRET_ADMIN
      );
    });

    it('deve retornar os dados do admin autenticado', async () => {
      const res = await request(app)
        .get('/api/admin/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe(adminPayload.email);
      expect(res.body.name).toBe(adminPayload.name);
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
      await Admin.findByIdAndUpdate(adminId, { active: false });

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
  let token;
  let adminId;

  const newAdminPayload = {
    name: 'Maria Admin',
    email: 'maria@test.com',  // e-mail diferente
    password: '123456',
  };

  beforeEach(async () => {
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(adminPayload.password, salt);

    const admin = await Admin.create({
      name: adminPayload.name,
      email: adminPayload.email,
      password: hashedPassword,
    });

    adminId = admin._id;
    token = jsonwebtoken.sign(
      { adminId: admin._id },
      process.env.JWT_SECRET_ADMIN
    );
  });

  it('deve cadastrar um admin com sucesso', async () => {
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
    // cria uma vez
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

});