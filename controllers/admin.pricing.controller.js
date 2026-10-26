import mongoose from 'mongoose';
import City from '../models/city.js';
import PricingRule, { ruleFromDoc } from '../models/pricingRule.js';
import { DEFAULT_RULE, calculateRiderPayout, validateRule } from '../utils/riderPayout.js';

// Regras de cálculo do valor da entrega, por cidade (só o admin geral).
// Cidade sem regra própria usa a regra padrão (a fórmula original). Mudar a
// regra vale para as PRÓXIMAS entregas: o valor de entregas já criadas fica
// gravado nelas e não muda.

const invalid = (res, errors) => res.status(400).json({
  error: 'Dados inválidos',
  details: errors.map((e) => ({ field: e.field, message: e.message })),
});

async function findCity(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(404).json({ error: 'Cidade não encontrada.' });
    return null;
  }
  const city = await City.findById(id).select('name state');
  if (!city) {
    res.status(404).json({ error: 'Cidade não encontrada.' });
    return null;
  }
  return city;
}

const cityDto = (c) => ({ id: c._id, name: c.name, state: c.state });
const view = (city, doc) => ({
  city: cityDto(city),
  custom: !!doc,
  rule: doc ? ruleFromDoc(doc) : { ...DEFAULT_RULE, adjustments: [], rain: { ...DEFAULT_RULE.rain } },
  updatedAt: doc?.updatedAt ?? null,
});

// GET /admin/pricing-rules — resumo: quais cidades têm regra própria e quais estão em modo chuva
export const listPricingRules = async (req, res) => {
  try {
    const docs = await PricingRule.find().select('city rain updatedAt').lean();
    return res.status(200).json(docs.map((d) => ({
      city: d.city,
      rainActive: !!d.rain?.active,
      rain: { active: !!d.rain?.active, kind: d.rain?.kind ?? 'percent', value: d.rain?.value ?? 0 },
      updatedAt: d.updatedAt,
    })));
  } catch (error) {
    console.error('Erro no listPricingRules:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// GET /admin/cities/:id/pricing
export const getCityPricing = async (req, res) => {
  try {
    const city = await findCity(req, res);
    if (!city) return undefined;
    const doc = await PricingRule.findOne({ city: city._id }).lean();
    return res.status(200).json(view(city, doc));
  } catch (error) {
    console.error('Erro no getCityPricing:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// PUT /admin/cities/:id/pricing — grava a regra inteira (campos omitidos voltam ao padrão)
export const saveCityPricing = async (req, res) => {
  try {
    const city = await findCity(req, res);
    if (!city) return undefined;
    const v = validateRule(req.body);
    if (!v.ok) return invalid(res, v.errors);

    const doc = await PricingRule.findOneAndUpdate(
      { city: city._id },
      { $set: { ...v.rule, city: city._id } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true },
    ).lean();
    return res.status(200).json(view(city, doc));
  } catch (error) {
    console.error('Erro no saveCityPricing:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// DELETE /admin/cities/:id/pricing — volta para a regra padrão
export const resetCityPricing = async (req, res) => {
  try {
    const city = await findCity(req, res);
    if (!city) return undefined;
    await PricingRule.deleteOne({ city: city._id });
    return res.status(200).json(view(city, null));
  } catch (error) {
    console.error('Erro no resetCityPricing:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// PATCH /admin/cities/:id/pricing/rain { active, kind?, value? } — liga/desliga o modo chuva sem mexer no resto
export const setCityRain = async (req, res) => {
  try {
    const city = await findCity(req, res);
    if (!city) return undefined;
    const body = req.body ?? {};
    if (typeof body.active !== 'boolean') return invalid(res, [{ field: 'active', message: 'Informe active como verdadeiro ou falso' }]);

    const existing = await PricingRule.findOne({ city: city._id }).lean();
    const current = existing ? ruleFromDoc(existing) : { ...DEFAULT_RULE, adjustments: [], rain: { ...DEFAULT_RULE.rain } };
    const v = validateRule({
      ...current,
      rain: {
        active: body.active,
        kind: body.kind ?? current.rain.kind,
        value: body.value ?? current.rain.value,
      },
    });
    if (!v.ok) return invalid(res, v.errors);

    const doc = await PricingRule.findOneAndUpdate(
      { city: city._id },
      { $set: { ...v.rule, city: city._id } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true },
    ).lean();
    return res.status(200).json(view(city, doc));
  } catch (error) {
    console.error('Erro no setCityRain:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// POST /admin/cities/:id/pricing/simulate { km, at?, rule? }
// Mostra quanto daria uma entrega de `km` quilômetros em `at` (padrão: agora).
// Se vier `rule`, simula essa regra (rascunho ainda não salvo); senão usa a salva.
export const simulateCityPricing = async (req, res) => {
  try {
    const city = await findCity(req, res);
    if (!city) return undefined;
    const { km, at, rule: draft } = req.body ?? {};

    if (typeof km !== 'number' || !Number.isFinite(km) || km < 0 || km > 500) {
      return invalid(res, [{ field: 'km', message: 'Distância deve ser um número entre 0 e 500' }]);
    }
    let when = new Date();
    if (at !== undefined) {
      when = new Date(at);
      if (typeof at !== 'string' || Number.isNaN(when.getTime())) return invalid(res, [{ field: 'at', message: 'Data e hora inválidas (use o formato ISO 8601)' }]);
    }

    let rule;
    if (draft !== undefined) {
      const v = validateRule(draft);
      if (!v.ok) return invalid(res, v.errors);
      rule = v.rule;
    } else {
      const doc = await PricingRule.findOne({ city: city._id }).lean();
      rule = doc ? ruleFromDoc(doc) : null;
    }

    const { total, breakdown } = calculateRiderPayout(km, rule, when);
    return res.status(200).json({ total, breakdown });
  } catch (error) {
    console.error('Erro no simulateCityPricing:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};
