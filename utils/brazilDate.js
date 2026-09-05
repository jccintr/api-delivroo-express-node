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

// Início da semana civil de Brasília "de agora" até agora. Convenção
// adotada: semana começa na segunda-feira (padrão ISO-8601) — mesmo que
// "hoje" seja terça, por exemplo, a soma só vai até agora (dias futuros da
// semana não têm entrega mesmo, então o fim é sempre "agora", não domingo).
export function weekBrazilRange(now = new Date()) {
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const [year, month, day] = todayStr.split('-').map(Number);
  // Construímos uma data "pura" em UTC a partir dos componentes já extraídos
  // no fuso de Brasília — assim getUTCDay() devolve o dia da semana em
  // Brasília, sem risco de a própria construção da data reintroduzir o
  // fuso local do processo (que no servidor de produção é UTC, mas não
  // custa nada não depender disso).
  const pureDate = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = pureDate.getUTCDay(); // 0 = domingo, 1 = segunda, ..., 6 = sábado
  const diffToMonday = (dayOfWeek + 6) % 7; // quantos dias voltar até a segunda-feira
  pureDate.setUTCDate(pureDate.getUTCDate() - diffToMonday);
  const mondayStr = pureDate.toISOString().slice(0, 10);

  return {
    start: toBrazilDayStart(mondayStr),
    end: toBrazilDayEnd(todayStr),
  };
}

// Início do mês civil de Brasília "de agora" (dia 1) até agora. Mesmo
// raciocínio do fim de período do weekBrazilRange: o fim é sempre "hoje",
// nunca o último dia do mês.
export function monthBrazilRange(now = new Date()) {
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const firstDayStr = `${todayStr.slice(0, 7)}-01`;

  return {
    start: toBrazilDayStart(firstDayStr),
    end: toBrazilDayEnd(todayStr),
  };
}