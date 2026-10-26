import mongoose from 'mongoose';
import { DEFAULT_RULE } from '../utils/riderPayout.js';

// Regras de cálculo do valor da entrega (o que o entregador recebe) de UMA
// cidade. Cidade sem documento aqui usa a regra padrão (DEFAULT_RULE), que é a
// fórmula original. A validação dos valores é feita por validateRule()
// (utils/riderPayout.js) antes de salvar; o schema é a segunda barreira.
const adjustmentSchema = new mongoose.Schema({
  name:   { type: String, required: true, trim: true, maxlength: 60 },
  kind:   { type: String, enum: ['percent', 'fixed'], required: true },
  value:  { type: Number, required: true, min: 0 },
  from:   { type: String, required: true }, // 'HH:MM', horário de Brasília
  to:     { type: String, required: true },
  days:   { type: [Number], default: [] },  // 0 = domingo ... 6 = sábado; vazio = todos
  active: { type: Boolean, default: true },
}, { _id: false });

const pricingRuleSchema = new mongoose.Schema({
  city: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true, unique: true },
  baseFee:             { type: Number, required: true, min: 0, default: DEFAULT_RULE.baseFee },
  perKm:               { type: Number, required: true, min: 0, default: DEFAULT_RULE.perKm },
  minimumFee:          { type: Number, required: true, min: 0, default: DEFAULT_RULE.minimumFee },
  longDistanceFromKm:  { type: Number, required: true, min: 0, default: DEFAULT_RULE.longDistanceFromKm },
  longDistanceBlockKm: { type: Number, required: true, min: 0.1, default: DEFAULT_RULE.longDistanceBlockKm },
  longDistanceExtra:   { type: Number, required: true, min: 0, default: DEFAULT_RULE.longDistanceExtra },
  maximumFee:          { type: Number, default: null, min: 0 },
  rounding:            { type: String, enum: ['integer', 'cents'], default: DEFAULT_RULE.rounding },
  adjustments:         { type: [adjustmentSchema], default: [] },
  // Modo chuva: o admin liga/desliga na mão, por cidade
  rain: {
    active: { type: Boolean, default: false },
    kind:   { type: String, enum: ['percent', 'fixed'], default: 'percent' },
    value:  { type: Number, default: 0, min: 0 },
  },
}, { timestamps: true });

const PricingRule = mongoose.models.PricingRule || mongoose.model('PricingRule', pricingRuleSchema);

/** Regra no formato que calculateRiderPayout entende, ou null (= regra padrão). */
export async function getRuleForCity(cityId) {
  if (!cityId) return null;
  const doc = await PricingRule.findOne({ city: cityId }).lean();
  return doc ? ruleFromDoc(doc) : null;
}

export function ruleFromDoc(doc) {
  return {
    baseFee: doc.baseFee,
    perKm: doc.perKm,
    minimumFee: doc.minimumFee,
    longDistanceFromKm: doc.longDistanceFromKm,
    longDistanceBlockKm: doc.longDistanceBlockKm,
    longDistanceExtra: doc.longDistanceExtra,
    maximumFee: doc.maximumFee ?? null,
    rounding: doc.rounding,
    adjustments: (doc.adjustments ?? []).map((a) => ({ name: a.name, kind: a.kind, value: a.value, from: a.from, to: a.to, days: a.days ?? [], active: a.active !== false })),
    rain: { active: !!doc.rain?.active, kind: doc.rain?.kind ?? 'percent', value: doc.rain?.value ?? 0 },
  };
}

export default PricingRule;
