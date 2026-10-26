import { brazilWeekdayAndMinutes } from './brazilDate.js';

// Cálculo do valor da entrega (o que o entregador recebe).
//
// Função pura: recebe a distância, as regras da cidade e o instante, e devolve
// o total com o DETALHAMENTO de como chegou nele. Nada aqui acessa banco ou
// rede, então dá para testar e simular (tela do admin) sem criar entrega.
//
// Ordem das contas:
//   1) valor base + preço por km
//   2) acima do limite de km, soma um adicional a cada bloco de km
//   3) aplica o valor mínimo
//   4) adicionais (faixas de horário ativas agora + modo chuva): os percentuais
//      incidem sobre o valor do passo 3 e NÃO se acumulam um sobre o outro;
//      os fixos em reais são somados
//   5) arredonda (real inteiro ou centavos) e aplica o teto, se houver

/** Regra padrão = a fórmula que já era usada antes das regras por cidade. */
export const DEFAULT_RULE = Object.freeze({
  baseFee: 8.55,
  perKm: 1.6,
  minimumFee: 8,
  longDistanceFromKm: 15,
  longDistanceBlockKm: 3,
  longDistanceExtra: 2,
  maximumFee: null,
  rounding: 'integer',
  adjustments: [],
  rain: { active: false, kind: 'percent', value: 0 },
});

const KINDS = ['percent', 'fixed'];
const ROUNDINGS = ['integer', 'cents'];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_ADJUSTMENTS = 20;
const LIMITS = { percent: 300, fixed: 100 };

const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const round2 = (n) => Math.round(n * 100) / 100;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** a faixa vale agora? Faixa que cruza a meia-noite (22:00–02:00) conta pelo dia em que COMEÇA. */
export function adjustmentIsActiveAt(adj, date = new Date()) {
  if (!adj || adj.active === false) return false;
  const { weekday, minutes } = brazilWeekdayAndMinutes(date);
  const from = toMinutes(adj.from);
  const to = toMinutes(adj.to);
  const days = adj.days?.length ? adj.days : [0, 1, 2, 3, 4, 5, 6];
  if (from < to) return days.includes(weekday) && minutes >= from && minutes < to;
  if (minutes >= from) return days.includes(weekday);
  if (minutes < to) return days.includes((weekday + 6) % 7);
  return false;
}

function applyRounding(value, rounding) {
  return rounding === 'cents' ? round2(value) : Math.round(value);
}

/**
 * @param {number} km distância em km
 * @param {object} [rule] regra da cidade (formato de DEFAULT_RULE); sem regra usa a padrão
 * @param {Date} [now] instante da criação da entrega
 * @returns {{ total: number, breakdown: object }}
 */
export function calculateRiderPayout(km, rule = null, now = new Date()) {
  const r = { ...DEFAULT_RULE, ...(rule ?? {}) };
  const rain = { ...DEFAULT_RULE.rain, ...(r.rain ?? {}) };
  const source = rule ? 'city' : 'default';

  const base = {
    source,
    appliedAt: now.toISOString(),
    distanceKm: isNum(km) ? km : null,
    baseFee: r.baseFee,
    perKm: r.perKm,
    minimumFee: r.minimumFee,
    rounding: r.rounding,
  };

  // distância inválida: cobra o mínimo (mesmo comportamento de antes)
  if (!isNum(km) || km < 0) {
    const total = applyRounding(r.minimumFee, r.rounding);
    return { total, breakdown: { ...base, distanceFee: 0, longDistanceExtra: 0, subtotal: r.minimumFee, minimumApplied: true, adjustments: [], beforeRounding: r.minimumFee, maximumApplied: false, total } };
  }

  const distanceFee = r.perKm * km;
  let raw = r.baseFee + distanceFee;
  let extra = 0;
  if (r.longDistanceExtra > 0 && km > r.longDistanceFromKm) {
    const blocks = Math.ceil((km - r.longDistanceFromKm) / r.longDistanceBlockKm);
    extra = blocks * r.longDistanceExtra;
    raw += extra;
  }

  const minimumApplied = raw < r.minimumFee;
  const subtotal = Math.max(r.minimumFee, raw);

  const applied = [];
  for (const adj of r.adjustments ?? []) {
    if (adjustmentIsActiveAt(adj, now)) applied.push({ origin: 'time', name: adj.name, kind: adj.kind, value: adj.value });
  }
  if (rain.active && rain.value > 0) applied.push({ origin: 'rain', name: 'Modo chuva', kind: rain.kind, value: rain.value });

  const adjustments = applied.map((a) => ({ ...a, amount: round2(a.kind === 'percent' ? (subtotal * a.value) / 100 : a.value) }));
  const beforeRounding = subtotal + adjustments.reduce((s, a) => s + a.amount, 0);

  let total = applyRounding(beforeRounding, r.rounding);
  const maximumApplied = r.maximumFee != null && total > r.maximumFee;
  if (maximumApplied) total = applyRounding(r.maximumFee, r.rounding);

  return {
    total,
    breakdown: {
      ...base,
      distanceFee: round2(distanceFee),
      longDistanceExtra: extra,
      subtotal: round2(subtotal),
      minimumApplied,
      adjustments,
      beforeRounding: round2(beforeRounding),
      maximumFee: r.maximumFee ?? null,
      maximumApplied,
      total,
    },
  };
}

// ---------------------------------------------------------------------------
// Validação das regras enviadas pelo admin
// ---------------------------------------------------------------------------

function numberField(errors, input, field, label, { min = 0, max, nullable = false, defaultValue }) {
  const v = input[field];
  if (v === undefined) return defaultValue;
  if (v === null && nullable) return null;
  if (!isNum(v) || v < min || (max !== undefined && v > max)) {
    errors.push({ field, message: `${label} deve ser um número entre ${min} e ${max ?? 'o limite permitido'}` });
    return defaultValue;
  }
  return v;
}

/**
 * Valida e normaliza uma regra de cidade.
 * Campos omitidos assumem o valor padrão. Devolve { ok, rule } ou { ok: false, errors: [{ field, message }] }.
 */
export function validateRule(input) {
  const errors = [];
  const src = input && typeof input === 'object' ? input : {};
  const d = DEFAULT_RULE;

  const rule = {
    baseFee: numberField(errors, src, 'baseFee', 'Valor base', { max: 1000, defaultValue: d.baseFee }),
    perKm: numberField(errors, src, 'perKm', 'Preço por km', { max: 100, defaultValue: d.perKm }),
    minimumFee: numberField(errors, src, 'minimumFee', 'Valor mínimo', { max: 1000, defaultValue: d.minimumFee }),
    longDistanceFromKm: numberField(errors, src, 'longDistanceFromKm', 'Km a partir do qual vale o adicional de distância longa', { max: 1000, defaultValue: d.longDistanceFromKm }),
    longDistanceBlockKm: numberField(errors, src, 'longDistanceBlockKm', 'Tamanho do bloco de km do adicional', { min: 0.1, max: 1000, defaultValue: d.longDistanceBlockKm }),
    longDistanceExtra: numberField(errors, src, 'longDistanceExtra', 'Adicional por bloco de km', { max: 1000, defaultValue: d.longDistanceExtra }),
    maximumFee: numberField(errors, src, 'maximumFee', 'Teto do valor', { max: 10000, nullable: true, defaultValue: null }),
    rounding: ROUNDINGS.includes(src.rounding) ? src.rounding : d.rounding,
    adjustments: [],
    rain: { ...d.rain },
  };

  if (src.rounding !== undefined && !ROUNDINGS.includes(src.rounding)) {
    errors.push({ field: 'rounding', message: 'Arredondamento deve ser "integer" (real inteiro) ou "cents" (centavos)' });
  }
  if (rule.maximumFee != null && rule.maximumFee < rule.minimumFee) {
    errors.push({ field: 'maximumFee', message: 'O teto não pode ser menor que o valor mínimo' });
  }

  if (src.adjustments !== undefined) {
    if (!Array.isArray(src.adjustments) || src.adjustments.length > MAX_ADJUSTMENTS) {
      errors.push({ field: 'adjustments', message: `Adicionais de horário devem ser uma lista de até ${MAX_ADJUSTMENTS} itens` });
    } else {
      src.adjustments.forEach((a, i) => {
        const f = (k) => `adjustments[${i}].${k}`;
        const name = typeof a?.name === 'string' ? a.name.trim() : '';
        if (name.length < 1 || name.length > 60) errors.push({ field: f('name'), message: 'Nome do adicional deve ter de 1 a 60 caracteres' });
        if (!KINDS.includes(a?.kind)) errors.push({ field: f('kind'), message: 'Tipo do adicional deve ser "percent" ou "fixed"' });
        const max = LIMITS[a?.kind] ?? LIMITS.fixed;
        if (!isNum(a?.value) || a.value <= 0 || a.value > max) errors.push({ field: f('value'), message: `Valor do adicional deve ser maior que 0 e até ${max}${a?.kind === 'percent' ? '%' : ' reais'}` });
        if (typeof a?.from !== 'string' || !HHMM.test(a.from)) errors.push({ field: f('from'), message: 'Horário inicial deve estar no formato HH:MM' });
        if (typeof a?.to !== 'string' || !HHMM.test(a.to)) errors.push({ field: f('to'), message: 'Horário final deve estar no formato HH:MM' });
        if (HHMM.test(a?.from ?? '') && HHMM.test(a?.to ?? '') && a.from === a.to) errors.push({ field: f('to'), message: 'Horário final deve ser diferente do inicial' });
        const days = a?.days ?? [];
        if (!Array.isArray(days) || days.some((x) => !Number.isInteger(x) || x < 0 || x > 6)) errors.push({ field: f('days'), message: 'Dias da semana devem ser números de 0 (domingo) a 6 (sábado)' });
        rule.adjustments.push({
          name, kind: a?.kind, value: a?.value, from: a?.from, to: a?.to,
          days: Array.isArray(days) ? [...new Set(days)].sort() : [],
          active: a?.active !== false,
        });
      });
    }
  }

  if (src.rain !== undefined) {
    const rn = src.rain && typeof src.rain === 'object' ? src.rain : {};
    const kind = rn.kind ?? d.rain.kind;
    if (!KINDS.includes(kind)) errors.push({ field: 'rain.kind', message: 'Tipo do adicional de chuva deve ser "percent" ou "fixed"' });
    const value = rn.value ?? 0;
    if (!isNum(value) || value < 0 || value > (LIMITS[kind] ?? LIMITS.fixed)) errors.push({ field: 'rain.value', message: `Valor do adicional de chuva deve ser entre 0 e ${LIMITS[kind] ?? LIMITS.fixed}` });
    if (rn.active !== undefined && typeof rn.active !== 'boolean') errors.push({ field: 'rain.active', message: 'Modo chuva deve ser verdadeiro ou falso' });
    if (rn.active === true && !(isNum(value) && value > 0)) errors.push({ field: 'rain.value', message: 'Para ligar o modo chuva, informe o valor do adicional' });
    rule.rain = { active: rn.active === true, kind: KINDS.includes(kind) ? kind : d.rain.kind, value: isNum(value) ? value : 0 };
  }

  return errors.length ? { ok: false, errors } : { ok: true, rule };
}
