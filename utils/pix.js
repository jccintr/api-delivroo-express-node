// Gerador de "Pix copia e cola" / QR code estático (BR Code, padrão EMV do
// Banco Central), sem gateway de pagamento: o dinheiro cai direto na chave
// Pix configurada no .env e a confirmação é feita manualmente pelo admin.
//
// Variáveis de ambiente lidas por getPixConfig():
//   PIX_KEY            chave Pix que recebe (CPF/CNPJ só dígitos, e-mail,
//                      telefone no formato +5511999999999 ou chave aleatória)
//   PIX_RECEIVER_NAME  nome do recebedor (máx. 25 caracteres no QR)
//   PIX_RECEIVER_CITY  cidade do recebedor (máx. 15 caracteres no QR)
//   PIX_DESCRIPTION    (opcional) texto curto que aparece no app do pagador

export class PixNotConfiguredError extends Error {
  constructor(missing) {
    super(`Pix não configurado: defina ${missing.join(', ')} no .env`);
    this.name = 'PixNotConfiguredError';
    this.code = 'PIX_NOT_CONFIGURED';
    this.missing = missing;
  }
}

// CRC16/CCITT-FALSE (polinômio 0x1021, valor inicial 0xFFFF), exigido no
// último campo (63) do BR Code. Retorna 4 caracteres hexadecimais maiúsculos.
export function crc16(text) {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i += 1) {
    crc ^= text.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Monta um campo TLV: id (2 dígitos) + tamanho (2 dígitos) + valor.
function field(id, value) {
  const text = String(value);
  if (text.length > 99) {
    throw new Error(`Campo ${id} do BR Code excede 99 caracteres`);
  }
  return `${id}${String(text.length).padStart(2, '0')}${text}`;
}

// Nome/cidade do QR: sem acentos, caixa alta, só caracteres simples.
function sanitizeText(value, max) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

// Identificador da transação (txid): 1 a 25 caracteres alfanuméricos.
export function sanitizeTxid(value) {
  const txid = String(value ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25);
  return txid || '***';
}

export function getPixConfig(env = process.env) {
  const key = (env.PIX_KEY ?? '').trim();
  const name = sanitizeText(env.PIX_RECEIVER_NAME, 25);
  const city = sanitizeText(env.PIX_RECEIVER_CITY, 15);
  const description = (env.PIX_DESCRIPTION ?? '').trim();

  const missing = [];
  if (!key) missing.push('PIX_KEY');
  if (!name) missing.push('PIX_RECEIVER_NAME');
  if (!city) missing.push('PIX_RECEIVER_CITY');
  if (missing.length > 0) {
    throw new PixNotConfiguredError(missing);
  }

  return { key, name, city, description };
}

// Gera a string do "Pix copia e cola" (também é o conteúdo do QR code).
// `amount` em reais (ex.: 28 ou 28.5). Lança erro se algo estiver inválido.
export function buildPixPayload({ key, name, city, amount, txid, description = '' }) {
  if (!key) throw new Error('Chave Pix obrigatória');

  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0 || value > 999999.99) {
    throw new Error('Valor do Pix inválido');
  }

  // Conta do recebedor (campo 26): GUI + chave + descrição opcional. O campo
  // inteiro não pode passar de 99 caracteres, então a descrição é cortada
  // para caber no que sobrar.
  const gui = field('00', 'br.gov.bcb.pix');
  const keyField = field('01', key);
  let merchantAccount = gui + keyField;
  const desc = sanitizeText(description, 40);
  if (desc) {
    const room = 99 - merchantAccount.length - 4; // 4 = id + tamanho do campo 02
    if (room > 0) {
      merchantAccount += field('02', desc.slice(0, room));
    }
  }
  if (merchantAccount.length > 99) {
    throw new Error('Chave Pix longa demais para o BR Code');
  }

  const body =
    field('00', '01') + // versão do payload
    field('01', '11') + // QR estático (reutilizável)
    field('26', merchantAccount) +
    field('52', '0000') + // categoria do comerciante (não informada)
    field('53', '986') + // moeda: BRL
    field('54', value.toFixed(2)) +
    field('58', 'BR') +
    field('59', sanitizeText(name, 25) || 'RECEBEDOR') +
    field('60', sanitizeText(city, 15) || 'BRASIL') +
    field('62', field('05', sanitizeTxid(txid)));

  const withCrcHeader = `${body}6304`;
  return withCrcHeader + crc16(withCrcHeader);
}

// Lê o TLV de primeiro nível de um BR Code — usado nos testes para conferir
// o que foi gerado, e útil para depuração.
export function parsePixPayload(payload) {
  const result = {};
  let i = 0;
  while (i < payload.length) {
    const id = payload.slice(i, i + 2);
    const length = Number(payload.slice(i + 2, i + 4));
    result[id] = payload.slice(i + 4, i + 4 + length);
    i += 4 + length;
  }
  return result;
}
