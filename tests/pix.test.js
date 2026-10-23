import { describe, it, expect } from 'vitest';
import { buildPixPayload, crc16, getPixConfig, parsePixPayload, PixNotConfiguredError, sanitizeTxid } from '../utils/pix.js';

describe('utils/pix — Pix copia e cola (BR Code)', () => {
  it('crc16 bate com o vetor de teste conhecido (CRC-16/CCITT-FALSE de "123456789")', () => {
    expect(crc16('123456789')).toBe('29B1');
  });

  it('gera um payload com os campos obrigatórios e CRC válido', () => {
    const payload = buildPixPayload({
      key: '+5535999999999',
      name: 'João da Silva',
      city: 'São Paulo',
      amount: 28,
      txid: 'R-7K3F9Q',
      description: 'Pacote 20 entregas',
    });

    const fields = parsePixPayload(payload);
    expect(fields['00']).toBe('01');
    expect(fields['01']).toBe('11');
    expect(fields['26']).toContain('br.gov.bcb.pix');
    expect(fields['26']).toContain('+5535999999999');
    expect(fields['53']).toBe('986');
    expect(fields['54']).toBe('28.00');
    expect(fields['58']).toBe('BR');
    expect(fields['59']).toBe('JOAO DA SILVA');
    expect(fields['60']).toBe('SAO PAULO');
    expect(fields['62']).toBe('0507R7K3F9Q');
    expect(payload.slice(-8, -4)).toBe('6304');
    expect(crc16(payload.slice(0, -4))).toBe(payload.slice(-4));
  });

  it('formata o valor com 2 casas decimais', () => {
    const payload = buildPixPayload({ key: 'a@b.com', name: 'X', city: 'Y', amount: 15.5, txid: 'A1' });
    expect(parsePixPayload(payload)['54']).toBe('15.50');
  });

  it('rejeita valor inválido e chave ausente', () => {
    expect(() => buildPixPayload({ key: 'a@b.com', name: 'X', city: 'Y', amount: 0, txid: 'A' })).toThrow();
    expect(() => buildPixPayload({ key: 'a@b.com', name: 'X', city: 'Y', amount: -1, txid: 'A' })).toThrow();
    expect(() => buildPixPayload({ key: 'a@b.com', name: 'X', city: 'Y', amount: 'abc', txid: 'A' })).toThrow();
    expect(() => buildPixPayload({ key: '', name: 'X', city: 'Y', amount: 10, txid: 'A' })).toThrow();
  });

  it('corta nome e cidade nos limites do BR Code e remove acentos', () => {
    const payload = buildPixPayload({
      key: 'a@b.com',
      name: 'Empresa de Tecnologia e Serviços Muito Longa Ltda',
      city: 'São José dos Campos do Sul',
      amount: 10,
      txid: 'A',
    });
    const fields = parsePixPayload(payload);
    expect(fields['59'].length).toBeLessThanOrEqual(25);
    expect(fields['60'].length).toBeLessThanOrEqual(15);
    expect(fields['59']).toMatch(/^[A-Z0-9 ]+$/);
  });

  it('mantém o campo da conta do recebedor dentro de 99 caracteres mesmo com descrição longa', () => {
    const payload = buildPixPayload({
      key: '123e4567-e89b-12d3-a456-426614174000',
      name: 'X',
      city: 'Y',
      amount: 10,
      txid: 'A',
      description: 'Uma descrição bem comprida que não cabe no campo inteiro do Pix',
    });
    expect(parsePixPayload(payload)['26'].length).toBeLessThanOrEqual(99);
  });

  it('sanitizeTxid mantém só letras e números (máx. 25)', () => {
    expect(sanitizeTxid('R-7K3F9Q')).toBe('R7K3F9Q');
    expect(sanitizeTxid('a'.repeat(40)).length).toBe(25);
    expect(sanitizeTxid('---')).toBe('***');
  });

  describe('getPixConfig', () => {
    it('lê a configuração do ambiente', () => {
      const config = getPixConfig({
        PIX_KEY: ' chave@pix.com ',
        PIX_RECEIVER_NAME: 'Júlio C',
        PIX_RECEIVER_CITY: 'Brazópolis',
      });
      expect(config).toEqual({ key: 'chave@pix.com', name: 'JULIO C', city: 'BRAZOPOLIS', description: '' });
    });

    it('lança PixNotConfiguredError listando o que falta', () => {
      try {
        getPixConfig({ PIX_KEY: 'x' });
        throw new Error('deveria ter lançado');
      } catch (error) {
        expect(error).toBeInstanceOf(PixNotConfiguredError);
        expect(error.code).toBe('PIX_NOT_CONFIGURED');
        expect(error.missing).toEqual(['PIX_RECEIVER_NAME', 'PIX_RECEIVER_CITY']);
      }
    });
  });
});
