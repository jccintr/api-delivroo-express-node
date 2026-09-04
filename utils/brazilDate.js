// Brasil não observa horário de verão desde 2019 (Lei nº 13.972/2019), então
// um offset fixo de -03:00 é seguro o ano inteiro — sem precisar de uma lib
// de fusos horários pra isso.
export const BRAZIL_UTC_OFFSET = '-03:00';

// Datas "soltas" (AAAA-MM-DD) são ancoradas no dia civil de Brasília, não em
// UTC — sem isso, um evento às 22h em Brasília já vira "o dia seguinte" em
// UTC e cai fora do período que o chamador esperava. Se o valor já vier com
// hora/offset próprios (ISO8601 completo), é respeitado como veio.
export function toBrazilDayStart(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00${BRAZIL_UTC_OFFSET}`);
  }
  return new Date(value);
}

export function toBrazilDayEnd(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T23:59:59.999${BRAZIL_UTC_OFFSET}`);
  }
  return new Date(value);
}

// Início e fim do dia civil de Brasília "de agora" — usado pelo mini
// dashboard do rider (estatísticas de hoje, que precisam resetar à meia-noite
// de Brasília, não a de UTC). Deriva a data (AAAA-MM-DD) já no fuso de
// Brasília a partir do instante atual, e reaproveita toBrazilDayStart/
// toBrazilDayEnd — que já sabem ancorar uma data "solta" nesse fuso — para
// montar os limites.
export function todayBrazilRange(now = new Date()) {
  // en-CA formata como AAAA-MM-DD — exatamente o formato que
  // toBrazilDayStart/toBrazilDayEnd esperam.
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return {
    start: toBrazilDayStart(todayStr),
    end: toBrazilDayEnd(todayStr),
  };
}