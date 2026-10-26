import { describe, it, expect } from 'vitest';
import { DEFAULT_RULE, adjustmentIsActiveAt, calculateRiderPayout, validateRule } from '../utils/riderPayout.js';
import { brazilWeekdayAndMinutes } from '../utils/brazilDate.js';

// Fórmula que existia no controller antes das regras por cidade — a regra padrão tem que dar o MESMO resultado.
function oldFormula(km) {
  if (km == null || km < 0) return 8;
  let taxa = 8.55 + 1.6 * km;
  if (km > 15) taxa += Math.ceil((km - 15) / 3) * 2;
  return Math.max(8, Math.round(taxa));
}

// Instantes em horário de Brasília (UTC-3). 2026-10-23 é sexta, 2026-10-24 sábado, 2026-10-25 domingo.
const at = (iso) => new Date(`${iso}-03:00`);

describe('regra padrão = fórmula antiga', () => {
  it('dá o mesmo valor de 0 a 80 km, de centésimo em centésimo', () => {
    for (let c = 0; c <= 8000; c += 1) {
      const km = c / 100;
      expect(calculateRiderPayout(km).total, `km ${km}`).toBe(oldFormula(km));
    }
  });
  it('distância inválida cobra o mínimo', () => {
    for (const km of [null, undefined, -1, NaN]) expect(calculateRiderPayout(km).total).toBe(8);
  });
  it('exemplos conhecidos', () => {
    const table = { 1: 10, 3: 13, 5: 17, 10: 25, 15: 33, 16: 36, 20: 45 };
    for (const [km, v] of Object.entries(table)) expect(calculateRiderPayout(Number(km)).total).toBe(v);
  });
  it('sem regra o detalhamento marca a origem "default"', () => {
    expect(calculateRiderPayout(5).breakdown.source).toBe('default');
    expect(calculateRiderPayout(5, DEFAULT_RULE).breakdown.source).toBe('city');
  });
});

describe('regra da cidade', () => {
  const rule = { ...DEFAULT_RULE, baseFee: 5, perKm: 2, minimumFee: 10, longDistanceFromKm: 10, longDistanceBlockKm: 5, longDistanceExtra: 3 };

  it('base + km, mínimo e faixa longa', () => {
    expect(calculateRiderPayout(2, rule).total).toBe(10); // 5+4=9 -> mínimo 10
    expect(calculateRiderPayout(2, rule).breakdown.minimumApplied).toBe(true);
    expect(calculateRiderPayout(6, rule).total).toBe(17); // 5+12
    expect(calculateRiderPayout(12, rule).total).toBe(32); // 5+24 + 1 bloco de 3
    expect(calculateRiderPayout(10.01, rule).total).toBe(28); // 5+20,02 = 25,02 -> 25 +3
  });

  it('adicional da faixa longa pode ser desligado com 0', () => {
    expect(calculateRiderPayout(30, { ...rule, longDistanceExtra: 0 }).total).toBe(65);
  });

  it('arredondamento em centavos', () => {
    const r = { ...DEFAULT_RULE, rounding: 'cents' };
    expect(calculateRiderPayout(5, r).total).toBe(16.55);
  });

  it('teto limita o total', () => {
    const r = { ...DEFAULT_RULE, maximumFee: 30 };
    expect(calculateRiderPayout(10, r).total).toBe(25);
    const big = calculateRiderPayout(40, r);
    expect(big.total).toBe(30);
    expect(big.breakdown.maximumApplied).toBe(true);
  });
});

describe('faixas de horário', () => {
  const noite = { name: 'Noite de fim de semana', kind: 'percent', value: 20, from: '18:00', to: '23:00', days: [5, 6], active: true };

  it('fuso de Brasília: 01:30 UTC de sábado ainda é sexta 22:30', () => {
    expect(brazilWeekdayAndMinutes(new Date('2026-10-24T01:30:00Z'))).toEqual({ weekday: 5, minutes: 22 * 60 + 30 });
  });

  it('vale só no dia e na hora certos (fim exclusivo)', () => {
    expect(adjustmentIsActiveAt(noite, at('2026-10-23T18:00:00'))).toBe(true);
    expect(adjustmentIsActiveAt(noite, at('2026-10-23T22:59:00'))).toBe(true);
    expect(adjustmentIsActiveAt(noite, at('2026-10-23T23:00:00'))).toBe(false);
    expect(adjustmentIsActiveAt(noite, at('2026-10-23T17:59:00'))).toBe(false);
    expect(adjustmentIsActiveAt(noite, at('2026-10-25T20:00:00'))).toBe(false); // domingo
  });

  it('faixa que cruza a meia-noite conta pelo dia em que começa', () => {
    const madrugada = { name: 'Madrugada', kind: 'fixed', value: 3, from: '22:00', to: '02:00', days: [5], active: true };
    expect(adjustmentIsActiveAt(madrugada, at('2026-10-23T23:30:00'))).toBe(true); // sexta 23:30
    expect(adjustmentIsActiveAt(madrugada, at('2026-10-24T01:00:00'))).toBe(true); // sábado 01:00 (ainda a faixa de sexta)
    expect(adjustmentIsActiveAt(madrugada, at('2026-10-24T23:30:00'))).toBe(false); // sábado à noite não
    expect(adjustmentIsActiveAt(madrugada, at('2026-10-24T02:00:00'))).toBe(false);
  });

  it('sem dias = todos os dias; desativada não vale', () => {
    expect(adjustmentIsActiveAt({ ...noite, days: [] }, at('2026-10-25T20:00:00'))).toBe(true);
    expect(adjustmentIsActiveAt({ ...noite, active: false }, at('2026-10-23T20:00:00'))).toBe(false);
  });

  it('percentual incide sobre o valor depois do mínimo; fixo soma', () => {
    const rule = { ...DEFAULT_RULE, adjustments: [noite] };
    const r = calculateRiderPayout(10, rule, at('2026-10-23T20:00:00')); // 24,55 + 20% = 29,46 -> 29
    expect(r.total).toBe(29);
    expect(r.breakdown.adjustments).toHaveLength(1);
    expect(r.breakdown.adjustments[0]).toMatchObject({ origin: 'time', name: 'Noite de fim de semana', amount: 4.91 });
    expect(calculateRiderPayout(10, rule, at('2026-10-25T20:00:00')).total).toBe(25); // fora da faixa
  });

  it('percentuais não se acumulam (cada um sobre o mesmo subtotal)', () => {
    const rule = { ...DEFAULT_RULE, rounding: 'cents', baseFee: 10, perKm: 0, minimumFee: 0, adjustments: [
      { name: 'A', kind: 'percent', value: 10, from: '00:00', to: '23:59', days: [], active: true },
      { name: 'B', kind: 'percent', value: 10, from: '00:00', to: '23:59', days: [], active: true },
    ] };
    expect(calculateRiderPayout(1, rule, at('2026-10-23T12:00:00')).total).toBe(12); // e não 12,10
  });
});

describe('modo chuva (manual)', () => {
  it('desligado não muda nada; ligado soma o adicional escolhido', () => {
    const off = { ...DEFAULT_RULE, rain: { active: false, kind: 'percent', value: 25 } };
    expect(calculateRiderPayout(10, off).total).toBe(25);

    const pct = { ...DEFAULT_RULE, rain: { active: true, kind: 'percent', value: 20 } };
    const r = calculateRiderPayout(10, pct); // 24,55 + 4,91 = 29,46
    expect(r.total).toBe(29);
    expect(r.breakdown.adjustments[0]).toMatchObject({ origin: 'rain', kind: 'percent', value: 20 });

    const fixed = { ...DEFAULT_RULE, rain: { active: true, kind: 'fixed', value: 4 } };
    expect(calculateRiderPayout(10, fixed).total).toBe(29); // 24,55 + 4 = 28,55 -> 29
  });

  it('chuva + horário somam, respeitando o teto', () => {
    const rule = { ...DEFAULT_RULE, maximumFee: 28, rain: { active: true, kind: 'fixed', value: 4 },
      adjustments: [{ name: 'Noite', kind: 'fixed', value: 2, from: '18:00', to: '23:00', days: [], active: true }] };
    const r = calculateRiderPayout(10, rule, at('2026-10-23T20:00:00')); // 24,55+2+4 = 30,55 -> 31 -> teto 28
    expect(r.total).toBe(28);
    expect(r.breakdown.maximumApplied).toBe(true);
    expect(r.breakdown.adjustments.map((a) => a.origin)).toEqual(['time', 'rain']);
  });
});

describe('validateRule', () => {
  it('objeto vazio vira a regra padrão', () => {
    const v = validateRule({});
    expect(v.ok).toBe(true);
    expect(v.rule).toMatchObject({ baseFee: 8.55, perKm: 1.6, minimumFee: 8, rounding: 'integer', maximumFee: null });
    expect(v.rule.adjustments).toEqual([]);
    expect(v.rule.rain).toEqual({ active: false, kind: 'percent', value: 0 });
  });

  it('normaliza adicionais (nome, dias únicos e ordenados)', () => {
    const v = validateRule({ adjustments: [{ name: '  Noite ', kind: 'percent', value: 15, from: '18:00', to: '23:00', days: [6, 5, 5] }] });
    expect(v.ok).toBe(true);
    expect(v.rule.adjustments[0]).toEqual({ name: 'Noite', kind: 'percent', value: 15, from: '18:00', to: '23:00', days: [5, 6], active: true });
  });

  it('recusa números ruins, com o campo e a mensagem', () => {
    const v = validateRule({ baseFee: -1, perKm: 'x', minimumFee: 5, maximumFee: 3, rounding: 'floor' });
    expect(v.ok).toBe(false);
    const fields = v.errors.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['baseFee', 'perKm', 'maximumFee', 'rounding']));
  });

  it('recusa adicional malformado', () => {
    const v = validateRule({ adjustments: [{ name: '', kind: 'dobro', value: 0, from: '25:00', to: '10:00', days: [7] }] });
    expect(v.ok).toBe(false);
    expect(v.errors.map((e) => e.field)).toEqual(expect.arrayContaining(['adjustments[0].name', 'adjustments[0].kind', 'adjustments[0].value', 'adjustments[0].from', 'adjustments[0].days']));
  });

  it('percentual acima de 300% e horários iguais são recusados', () => {
    expect(validateRule({ adjustments: [{ name: 'x', kind: 'percent', value: 301, from: '10:00', to: '11:00' }] }).ok).toBe(false);
    expect(validateRule({ adjustments: [{ name: 'x', kind: 'fixed', value: 2, from: '10:00', to: '10:00' }] }).ok).toBe(false);
  });

  it('ligar o modo chuva exige o valor', () => {
    expect(validateRule({ rain: { active: true, kind: 'percent', value: 0 } }).ok).toBe(false);
    const ok = validateRule({ rain: { active: true, kind: 'percent', value: 20 } });
    expect(ok.ok).toBe(true);
    expect(ok.rule.rain).toEqual({ active: true, kind: 'percent', value: 20 });
  });

  it('mais de 20 adicionais é recusado', () => {
    const a = { name: 'x', kind: 'fixed', value: 1, from: '10:00', to: '11:00' };
    expect(validateRule({ adjustments: Array.from({ length: 21 }, () => a) }).ok).toBe(false);
  });

  it('o resultado validado calcula igual à entrada', () => {
    const v = validateRule({ baseFee: 5, perKm: 2, minimumFee: 10 });
    expect(calculateRiderPayout(6, v.rule).total).toBe(17);
  });
});
