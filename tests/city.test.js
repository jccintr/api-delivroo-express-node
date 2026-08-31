import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import City from '../models/city.js';
import { createCity } from './factories/city.factory.js';

describe('City Routes', () => {
  // =====================
  // LIST ACTIVE CITIES (público)
  // =====================
  describe('GET /api/cities', () => {
    it('deve retornar 200 e uma lista vazia quando não houver cidades', async () => {
      const res = await request(app).get('/api/cities');

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body).toHaveLength(0);
    });

    it('deve retornar 200 e listar apenas cidades ativas', async () => {
      await createCity({
        name: 'São Paulo',
        state: 'SP',
        slug: 'sao-paulo-sp',
        active: true,
      });
      await createCity({
        name: 'Campinas',
        state: 'SP',
        slug: 'campinas-sp',
        active: true,
      });
      await createCity({
        name: 'Santos',
        state: 'SP',
        slug: 'santos-sp',
        active: false,
      });

      const res = await request(app).get('/api/cities');

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body).toHaveLength(2);

      const names = res.body.map((c) => c.name);
      expect(names).toContain('São Paulo');
      expect(names).toContain('Campinas');
      expect(names).not.toContain('Santos');

      // todas retornadas devem estar ativas (se o campo vier no payload)
      res.body.forEach((city) => {
        if (city.active !== undefined) {
          expect(city.active).toBe(true);
        }
      });
    });

    it('deve retornar cidades ordenadas por nome', async () => {
      await createCity({
        name: 'Campinas',
        state: 'SP',
        slug: 'campinas-sp',
        active: true,
      });
      await createCity({
        name: 'Americana',
        state: 'SP',
        slug: 'americana-sp',
        active: true,
      });
      await createCity({
        name: 'São Paulo',
        state: 'SP',
        slug: 'sao-paulo-sp',
        active: true,
      });

      const res = await request(app).get('/api/cities');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
      expect(res.body[0].name).toBe('Americana');
      expect(res.body[1].name).toBe('Campinas');
      expect(res.body[2].name).toBe('São Paulo');
    });

    it('deve retornar apenas os campos necessários (name, state, slug e _id)', async () => {
      await createCity({
        name: 'São Paulo',
        state: 'SP',
        slug: 'sao-paulo-sp',
        active: true,
        center: { latitude: -23.55, longitude: -46.63 },
        radiusKm: 30,
      });

      const res = await request(app).get('/api/cities');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);

      const city = res.body[0];
      expect(city).toHaveProperty('_id');
      expect(city).toHaveProperty('name', 'São Paulo');
      expect(city).toHaveProperty('state', 'SP');
      expect(city).toHaveProperty('slug', 'sao-paulo-sp');

      // não deve expor campos internos desnecessários no cadastro
      expect(city).not.toHaveProperty('center');
      expect(city).not.toHaveProperty('radiusKm');
      expect(city).not.toHaveProperty('__v');
    });

    it('não deve exigir autenticação (rota pública)', async () => {
      await createCity({
        name: 'São Paulo',
        state: 'SP',
        slug: 'sao-paulo-sp',
        active: true,
      });

      // sem header Authorization
      const res = await request(app).get('/api/cities');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });
});