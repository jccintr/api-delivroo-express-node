import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import Delivery from '../models/delivery.js';
import Store from '../models/store.js';
import PricingRule from '../models/pricingRule.js';
import { createAdminWithToken } from './factories/admin.factory.js';
import { createStoreWithToken } from './factories/store.factory.js';
import { createCity } from './factories/city.factory.js';
import { createDeliveryPayload } from './factories/delivery.factory.js';

// A distância vem do Google: aqui ela é fixa para o valor ser previsível (12 km).
vi.mock('../utils/googleMaps.js', () => ({
  distanceBetween: vi.fn(async () => ({ meters: 12000, seconds: 1200, distanceText: '12 km', durationText: '20 min' })),
  geocodeAddress: vi.fn(async () => null),
}));

const RULE = { baseFee: 5, perKm: 2, minimumFee: 10, longDistanceFromKm: 10, longDistanceBlockKm: 5, longDistanceExtra: 3 };
// 12 km: 5 + 24 = 29, mais 1 bloco acima de 10 km (+3) = 32

describe('Regras de valor da entrega por cidade', () => {
  let admin;
  let city;
  const auth = () => ({ Authorization: `Bearer ${admin.token}` });
  const url = (c = city) => `/api/admin/cities/${c._id}/pricing`;

  beforeEach(async () => {
    admin = await createAdminWithToken();
    city = await createCity();
  });

  describe('autenticação', () => {
    it('todas as rotas exigem login do admin', async () => {
      const calls = [
        request(app).get('/api/admin/pricing-rules'),
        request(app).get(url()),
        request(app).put(url()).send({}),
        request(app).delete(url()),
        request(app).patch(`${url()}/rain`).send({ active: false }),
        request(app).post(`${url()}/simulate`).send({ km: 5 }),
      ];
      for (const call of calls) expect((await call).status).toBe(401);
    });
  });

  describe('GET/PUT/DELETE /api/admin/cities/:id/pricing', () => {
    it('cidade sem regra própria mostra a regra padrão', async () => {
      const res = await request(app).get(url()).set(auth());
      expect(res.status).toBe(200);
      expect(res.body.custom).toBe(false);
      expect(res.body.city).toMatchObject({ name: 'São Paulo', state: 'SP' });
      expect(res.body.rule).toMatchObject({ baseFee: 8.55, perKm: 1.6, minimumFee: 8, longDistanceFromKm: 15, longDistanceExtra: 2, rounding: 'integer' });
    });

    it('salva a regra da cidade e devolve ela', async () => {
      const res = await request(app).put(url()).set(auth()).send({
        ...RULE,
        maximumFee: 80,
        adjustments: [{ name: 'Noite de fim de semana', kind: 'percent', value: 20, from: '18:00', to: '23:00', days: [5, 6] }],
        rain: { active: true, kind: 'fixed', value: 4 },
      });
      expect(res.status).toBe(200);
      expect(res.body.custom).toBe(true);
      expect(res.body.rule).toMatchObject({ ...RULE, maximumFee: 80, rain: { active: true, kind: 'fixed', value: 4 } });
      expect(res.body.rule.adjustments).toEqual([{ name: 'Noite de fim de semana', kind: 'percent', value: 20, from: '18:00', to: '23:00', days: [5, 6], active: true }]);

      const again = await request(app).get(url()).set(auth());
      expect(again.body.custom).toBe(true);
      expect(again.body.rule.baseFee).toBe(5);
      expect(await PricingRule.countDocuments({ city: city._id })).toBe(1);
    });

    it('salvar de novo substitui a regra (uma por cidade)', async () => {
      await request(app).put(url()).set(auth()).send(RULE).expect(200);
      await request(app).put(url()).set(auth()).send({ ...RULE, baseFee: 7 }).expect(200);
      expect(await PricingRule.countDocuments({ city: city._id })).toBe(1);
      expect((await request(app).get(url()).set(auth())).body.rule.baseFee).toBe(7);
    });

    it('400 com campo e mensagem para valores inválidos', async () => {
      const res = await request(app).put(url()).set(auth()).send({ baseFee: -1, adjustments: [{ name: '', kind: 'dobro', value: 0, from: '25:00', to: '10:00' }] });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
      expect(res.body.details.map((d) => d.field)).toEqual(expect.arrayContaining(['baseFee', 'adjustments[0].name', 'adjustments[0].kind']));
      expect(await PricingRule.countDocuments()).toBe(0);
    });

    it('404 para cidade inexistente ou id inválido', async () => {
      expect((await request(app).get('/api/admin/cities/64b7f0c2a1b2c3d4e5f60718/pricing').set(auth())).status).toBe(404);
      expect((await request(app).get('/api/admin/cities/abc/pricing').set(auth())).status).toBe(404);
      expect((await request(app).put('/api/admin/cities/abc/pricing').set(auth()).send({})).status).toBe(404);
    });

    it('DELETE volta para a regra padrão', async () => {
      await request(app).put(url()).set(auth()).send(RULE).expect(200);
      const res = await request(app).delete(url()).set(auth());
      expect(res.status).toBe(200);
      expect(res.body.custom).toBe(false);
      expect(await PricingRule.countDocuments()).toBe(0);
    });
  });

  describe('modo chuva', () => {
    it('liga e desliga sem mexer no resto da regra', async () => {
      await request(app).put(url()).set(auth()).send(RULE).expect(200);

      const on = await request(app).patch(`${url()}/rain`).set(auth()).send({ active: true, kind: 'percent', value: 20 });
      expect(on.status).toBe(200);
      expect(on.body.rule.rain).toEqual({ active: true, kind: 'percent', value: 20 });
      expect(on.body.rule.baseFee).toBe(5);

      const off = await request(app).patch(`${url()}/rain`).set(auth()).send({ active: false });
      expect(off.body.rule.rain).toEqual({ active: false, kind: 'percent', value: 20 }); // lembra o valor para ligar de novo
    });

    it('cidade sem regra própria: ligar a chuva cria a regra com os valores padrão', async () => {
      const res = await request(app).patch(`${url()}/rain`).set(auth()).send({ active: true, kind: 'fixed', value: 3 });
      expect(res.status).toBe(200);
      expect(res.body.rule.baseFee).toBe(8.55);
      expect(res.body.rule.rain.active).toBe(true);
    });

    it('exige o valor para ligar e um booleano em active', async () => {
      expect((await request(app).patch(`${url()}/rain`).set(auth()).send({ active: true })).status).toBe(400);
      expect((await request(app).patch(`${url()}/rain`).set(auth()).send({ active: 'sim' })).status).toBe(400);
    });

    it('GET /api/admin/pricing-rules mostra quais cidades estão em modo chuva', async () => {
      const other = await createCity();
      await request(app).patch(`${url()}/rain`).set(auth()).send({ active: true, kind: 'percent', value: 15 }).expect(200);
      await request(app).put(url(other)).set(auth()).send(RULE).expect(200);

      const res = await request(app).get('/api/admin/pricing-rules').set(auth());
      expect(res.status).toBe(200);
      const byCity = Object.fromEntries(res.body.map((r) => [String(r.city), r.rainActive]));
      expect(byCity[String(city._id)]).toBe(true);
      expect(byCity[String(other._id)]).toBe(false);
    });
  });

  describe('POST /api/admin/cities/:id/pricing/simulate', () => {
    it('sem regra salva usa a padrão', async () => {
      const res = await request(app).post(`${url()}/simulate`).set(auth()).send({ km: 10 });
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(25);
      expect(res.body.breakdown.source).toBe('default');
    });

    it('usa a regra salva e o horário informado', async () => {
      await request(app).put(url()).set(auth()).send({
        ...RULE,
        adjustments: [{ name: 'Noite', kind: 'percent', value: 50, from: '18:00', to: '23:00', days: [5] }],
      }).expect(200);
      // sexta 2026-10-23 às 20:00 em Brasília, 6 km: 5 + 12 = 17 (+50% = 25,5 -> 26)
      const fri = await request(app).post(`${url()}/simulate`).set(auth()).send({ km: 6, at: '2026-10-23T20:00:00-03:00' });
      expect(fri.body.total).toBe(26);
      expect(fri.body.breakdown.adjustments[0]).toMatchObject({ origin: 'time', name: 'Noite' });
      const sat = await request(app).post(`${url()}/simulate`).set(auth()).send({ km: 6, at: '2026-10-24T20:00:00-03:00' });
      expect(sat.body.total).toBe(17);
    });

    it('simula um rascunho sem salvar', async () => {
      const res = await request(app).post(`${url()}/simulate`).set(auth()).send({ km: 6, rule: { baseFee: 20, perKm: 0, minimumFee: 0 } });
      expect(res.body.total).toBe(20);
      expect(await PricingRule.countDocuments()).toBe(0);
    });

    it('400 para distância, data ou rascunho inválidos', async () => {
      expect((await request(app).post(`${url()}/simulate`).set(auth()).send({ km: 'x' })).status).toBe(400);
      expect((await request(app).post(`${url()}/simulate`).set(auth()).send({ km: -1 })).status).toBe(400);
      expect((await request(app).post(`${url()}/simulate`).set(auth()).send({ km: 5, at: 'ontem' })).status).toBe(400);
      expect((await request(app).post(`${url()}/simulate`).set(auth()).send({ km: 5, rule: { baseFee: -2 } })).status).toBe(400);
    });
  });

  describe('criação da entrega usa a regra da cidade da loja', () => {
    const createFor = async (c) => {
      const { token, store } = await createStoreWithToken({ password: '123456', city: c._id });
      await Store.findByIdAndUpdate(store._id, { emailVerifiedAt: new Date() });
      const res = await request(app).post('/api/stores/deliveries').set('Authorization', `Bearer ${token}`).send(createDeliveryPayload());
      return { res, token };
    };

    it('cidade sem regra própria: fórmula padrão, igual a antes', async () => {
      const { res } = await createFor(city);
      expect(res.status).toBe(201);
      expect(res.body.distancia).toBe(12);
      expect(res.body.riderPayout).toBe(oldFormula(12)); // 8,55 + 19,2 = 27,75 -> 28
    });

    it('cidade com regra própria', async () => {
      await request(app).put(url()).set(auth()).send(RULE).expect(200);
      const { res } = await createFor(city);
      expect(res.status).toBe(201);
      expect(res.body.riderPayout).toBe(32);
    });

    it('modo chuva ligado aumenta o valor da PRÓXIMA entrega, não das anteriores', async () => {
      await request(app).put(url()).set(auth()).send(RULE).expect(200);
      const first = await createFor(city);
      expect(first.res.body.riderPayout).toBe(32);

      await request(app).patch(`${url()}/rain`).set(auth()).send({ active: true, kind: 'percent', value: 20 }).expect(200);
      const second = await createFor(city);
      expect(second.res.body.riderPayout).toBe(38); // 32 + 6,4 = 38,4

      const stored = await Delivery.findById(first.res.body._id);
      expect(stored.riderPayout).toBe(32); // a entrega antiga não mudou
    });

    it('cada cidade tem o seu cálculo', async () => {
      const other = await createCity();
      await request(app).put(url()).set(auth()).send(RULE).expect(200);
      expect((await createFor(city)).res.body.riderPayout).toBe(32);
      expect((await createFor(other)).res.body.riderPayout).toBe(oldFormula(12));
    });

    it('o detalhamento fica gravado, mas a loja e o entregador não o recebem; o admin recebe', async () => {
      await request(app).put(url()).set(auth()).send(RULE).expect(200);
      const { res, token } = await createFor(city);
      expect(res.body.payoutBreakdown).toBeUndefined();

      const plain = await Delivery.findById(res.body._id);
      expect(plain.payoutBreakdown).toBeUndefined(); // consultas comuns não trazem

      const full = await Delivery.findById(res.body._id).select('+payoutBreakdown');
      expect(full.payoutBreakdown).toMatchObject({ source: 'city', distanceKm: 12, baseFee: 5, perKm: 2, longDistanceExtra: 3, total: 32 });

      const mine = await request(app).get('/api/stores/deliveries/active').set('Authorization', `Bearer ${token}`);
      expect(JSON.stringify(mine.body)).not.toContain('payoutBreakdown');

      const adm = await request(app).get('/api/admin/deliveries').set(auth());
      expect(adm.status).toBe(200);
      expect(adm.body.data[0].payoutBreakdown).toMatchObject({ source: 'city', total: 32 });
    });
  });
});

// a fórmula de antes das regras por cidade, para provar que o padrão não mudou
function oldFormula(km) {
  let taxa = 8.55 + 1.6 * km;
  if (km > 15) taxa += Math.ceil((km - 15) / 3) * 2;
  return Math.max(8, Math.round(taxa));
}
