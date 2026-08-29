import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRider } from './factories/rider.factory.js';
import Rider from '../models/rider.js';
import {
  sendPushNotifications,
  notifyNewDeliveryAvailable,
  notifyRiderDeliveryCancelled,
} from '../utils/pushNotifications.js';

function mockExpoResponse(tickets) {
  return { ok: true, json: async () => ({ data: tickets }) };
}

describe('utils/pushNotifications', () => {
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockExpoResponse([]));
  });

  // Crucial: vi.spyOn num alvo que já está espionado (ex: o mesmo
  // globalThis.fetch do teste anterior) devolve o MESMO mock, com o
  // histórico de chamadas acumulado — só trocar mockResolvedValue não
  // limpa `.mock.calls`. restoreAllMocks() desfaz o espião por completo,
  // então o próximo beforeEach cria um mock genuinamente novo, com
  // histórico zerado.
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.EXPO_ACCESS_TOKEN;
  });

  describe('sendPushNotifications', () => {
    it('ignora mensagens com token em formato inválido, sem chamar fetch se nenhuma sobrar', async () => {
      await sendPushNotifications([{ to: 'token-invalido', title: 'x', body: 'y' }]);

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('envia só as mensagens com token válido para o endpoint da Expo', async () => {
      const messages = [
        { to: 'ExponentPushToken[valido1]', title: 'a', body: 'b' },
        { to: 'token-invalido', title: 'c', body: 'd' },
      ];

      await sendPushNotifications(messages);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://exp.host/--/api/v2/push/send');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(options.body)).toEqual([messages[0]]);
    });

    it('não inclui Authorization quando EXPO_ACCESS_TOKEN não está configurado', async () => {
      await sendPushNotifications([{ to: 'ExponentPushToken[x]', title: 'a', body: 'b' }]);

      const [, options] = fetchSpy.mock.calls[0];
      expect(options.headers.Authorization).toBeUndefined();
    });

    it('inclui Authorization Bearer quando EXPO_ACCESS_TOKEN está configurado', async () => {
      process.env.EXPO_ACCESS_TOKEN = 'meu-token-secreto';

      await sendPushNotifications([{ to: 'ExponentPushToken[x]', title: 'a', body: 'b' }]);

      const [, options] = fetchSpy.mock.calls[0];
      expect(options.headers.Authorization).toBe('Bearer meu-token-secreto');
    });

    it('quebra em lotes de até 100 mensagens por request', async () => {
      const messages = Array.from({ length: 150 }, (_, i) => ({
        to: `ExponentPushToken[rider${i}]`,
        title: 'a',
        body: 'b',
      }));

      await sendPushNotifications(messages);

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const firstBatch = JSON.parse(fetchSpy.mock.calls[0][1].body);
      const secondBatch = JSON.parse(fetchSpy.mock.calls[1][1].body);
      expect(firstBatch).toHaveLength(100);
      expect(secondBatch).toHaveLength(50);
    });

    it('limpa o pushToken do rider quando o ticket volta com DeviceNotRegistered', async () => {
      const rider = await createRider({ pushToken: 'ExponentPushToken[morto]' });

      fetchSpy.mockResolvedValue(
        mockExpoResponse([{ status: 'error', details: { error: 'DeviceNotRegistered' } }]),
      );

      await sendPushNotifications([{ to: 'ExponentPushToken[morto]', title: 'a', body: 'b' }]);

      const updated = await Rider.findById(rider._id).select('pushToken');
      expect(updated.pushToken).toBeNull();
    });

    it('não limpa o pushToken quando o ticket é de sucesso', async () => {
      const rider = await createRider({ pushToken: 'ExponentPushToken[vivo]' });

      fetchSpy.mockResolvedValue(mockExpoResponse([{ status: 'ok', id: 'ticket-1' }]));

      await sendPushNotifications([{ to: 'ExponentPushToken[vivo]', title: 'a', body: 'b' }]);

      const updated = await Rider.findById(rider._id).select('pushToken');
      expect(updated.pushToken).toBe('ExponentPushToken[vivo]');
    });

    it('não lança erro quando o fetch falha (best-effort)', async () => {
      fetchSpy.mockRejectedValue(new Error('Expo API fora do ar'));

      await expect(
        sendPushNotifications([{ to: 'ExponentPushToken[x]', title: 'a', body: 'b' }]),
      ).resolves.toBeUndefined();
    });
  });

  describe('notifyNewDeliveryAvailable', () => {
    it('notifica só os riders online, ativos, verificados, aprovados e com pushToken', async () => {
      await createRider({
        online: true,
        active: true,
        emailVerifiedAt: new Date(),
        accountApprovedAt: new Date(),
        pushToken: 'ExponentPushToken[eligible]',
      });
      await createRider({ online: false, pushToken: 'ExponentPushToken[offline]' }); // offline
      await createRider({ online: true, active: false, pushToken: 'ExponentPushToken[inativo]' }); // desativado
      await createRider({ online: true, active: true, pushToken: null }); // sem token

      const delivery = { _id: { toString: () => 'delivery-1' }, riderPayout: 12.5, distancia: 3.2 };

      await notifyNewDeliveryAvailable(delivery, 'Loja Teste');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const sentBatch = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBatch).toHaveLength(1);
      expect(sentBatch[0].to).toBe('ExponentPushToken[eligible]');
      expect(sentBatch[0].title).toBe('Nova entrega disponível!');
      expect(sentBatch[0].body).toContain('Loja Teste');
      expect(sentBatch[0].data).toEqual({ type: 'delivery_available', deliveryId: 'delivery-1' });
    });

    it('não chama fetch quando não há nenhum rider elegível', async () => {
      await notifyNewDeliveryAvailable(
        { _id: { toString: () => 'd1' }, riderPayout: 10, distancia: 1 },
        'Loja X',
      );

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('notifyRiderDeliveryCancelled', () => {
    it('notifica o rider com o token salvo', async () => {
      const rider = await createRider({ pushToken: 'ExponentPushToken[cancelado]' });
      const delivery = { _id: { toString: () => 'd2' }, destino: { nome: 'Maria' } };

      await notifyRiderDeliveryCancelled(rider._id, delivery);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const sentBatch = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBatch[0].to).toBe('ExponentPushToken[cancelado]');
      expect(sentBatch[0].title).toBe('Entrega cancelada');
      expect(sentBatch[0].body).toContain('Maria');
    });

    it('não chama fetch quando o rider não tem pushToken salvo', async () => {
      const rider = await createRider({ pushToken: null });

      await notifyRiderDeliveryCancelled(rider._id, { _id: { toString: () => 'd3' }, destino: {} });

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});