import { describe, it, expect, afterEach } from 'vitest';
import http from 'http';
import WebSocket from 'ws';
import jsonwebtoken from 'jsonwebtoken';
import websocket, { notifyStore } from '../websocket.js';

function startServer(options) {
  return new Promise((resolve) => {
    const server = http.createServer();
    const wss = websocket(server, options);
    server.listen(0, () => resolve({ server, wss }));
  });
}

function wsUrl(server, token) {
  const { port } = server.address();
  const query = token !== undefined ? `?token=${encodeURIComponent(token)}` : '';
  return `ws://localhost:${port}${query}`;
}

function waitForOpen(ws) {
  return new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
}

function waitForMessage(ws) {
  return new Promise((resolve) => {
    ws.once('message', (data) => resolve(JSON.parse(data.toString())));
  });
}

function waitForClose(ws) {
  return new Promise((resolve) => ws.once('close', (code) => resolve(code)));
}

describe('websocket — notificação em tempo real da loja', () => {
  let server;
  let wss;
  let clients = [];

  afterEach(async () => {
    clients.forEach((c) => c.readyState === WebSocket.OPEN && c.close());
    clients = [];
    await new Promise((resolve) => server?.close(resolve));
    server = undefined;
    wss = undefined;
  });

  it('aceita a conexão com um token de loja válido', async () => {
    ({ server, wss } = await startServer());
    const token = jsonwebtoken.sign({ storeId: 'store-1' }, process.env.JWT_SECRET_STORE);

    const ws = new WebSocket(wsUrl(server, token));
    clients.push(ws);

    await expect(waitForOpen(ws)).resolves.toBeUndefined();
  });

  it('fecha a conexão quando não há token', async () => {
    ({ server, wss } = await startServer());
    const ws = new WebSocket(wsUrl(server));
    clients.push(ws);

    const code = await waitForClose(ws);
    expect(code).toBe(4001);
  });

  it('fecha a conexão quando o token é inválido', async () => {
    ({ server, wss } = await startServer());
    const ws = new WebSocket(wsUrl(server, 'token-invalido'));
    clients.push(ws);

    const code = await waitForClose(ws);
    expect(code).toBe(4001);
  });

  it('notifyStore entrega o evento só para as conexões da loja correta', async () => {
    ({ server, wss } = await startServer());
    const tokenA = jsonwebtoken.sign({ storeId: 'store-a' }, process.env.JWT_SECRET_STORE);
    const tokenB = jsonwebtoken.sign({ storeId: 'store-b' }, process.env.JWT_SECRET_STORE);

    const wsA = new WebSocket(wsUrl(server, tokenA));
    const wsB = new WebSocket(wsUrl(server, tokenB));
    clients.push(wsA, wsB);

    await Promise.all([waitForOpen(wsA), waitForOpen(wsB)]);

    const messageA = waitForMessage(wsA);
    let receivedByB = false;
    wsB.once('message', () => {
      receivedByB = true;
    });

    notifyStore('store-a', { type: 'delivery:updated', event: 'accepted', delivery: { _id: 'd1' } });

    const payload = await messageA;
    expect(payload).toEqual({ type: 'delivery:updated', event: 'accepted', delivery: { _id: 'd1' } });

    // dá um tempo pra garantir que a loja B realmente não recebeu nada
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(receivedByB).toBe(false);
  });

  it('notifyStore não lança erro quando a loja não está conectada', () => {
    expect(() =>
      notifyStore('loja-sem-conexao', { type: 'delivery:updated', event: 'accepted', delivery: {} }),
    ).not.toThrow();
  });

  it('múltiplas abas/conexões da mesma loja recebem o mesmo evento', async () => {
    ({ server, wss } = await startServer());
    const token = jsonwebtoken.sign({ storeId: 'store-multi' }, process.env.JWT_SECRET_STORE);

    const wsTab1 = new WebSocket(wsUrl(server, token));
    const wsTab2 = new WebSocket(wsUrl(server, token));
    clients.push(wsTab1, wsTab2);

    await Promise.all([waitForOpen(wsTab1), waitForOpen(wsTab2)]);

    const msg1 = waitForMessage(wsTab1);
    const msg2 = waitForMessage(wsTab2);

    notifyStore('store-multi', { type: 'delivery:updated', event: 'dispatched', delivery: { _id: 'd2' } });

    const [payload1, payload2] = await Promise.all([msg1, msg2]);
    expect(payload1.delivery._id).toBe('d2');
    expect(payload2.delivery._id).toBe('d2');
  });

  it('para de notificar uma conexão depois que ela fecha', async () => {
    ({ server, wss } = await startServer());
    const token = jsonwebtoken.sign({ storeId: 'store-close' }, process.env.JWT_SECRET_STORE);

    const ws = new WebSocket(wsUrl(server, token));
    clients.push(ws);
    await waitForOpen(ws);

    ws.close();
    await waitForClose(ws);

    // Nenhum listener deve disparar depois do close; se notifyStore
    // tentasse enviar para um socket fechado sem checar readyState, isso
    // lançaria um erro não tratado (unhandled 'error' no processo).
    expect(() =>
      notifyStore('store-close', { type: 'delivery:updated', event: 'delivered', delivery: {} }),
    ).not.toThrow();
  });

  // =====================
  // Heartbeat (ping/pong)
  // =====================
  describe('heartbeat', () => {
    it('mantém uma conexão saudável aberta através de vários ciclos de heartbeat (responde ping com pong automaticamente)', async () => {
      ({ server, wss } = await startServer({ heartbeatIntervalMs: 30 }));
      const token = jsonwebtoken.sign({ storeId: 'store-saudavel' }, process.env.JWT_SECRET_STORE);

      const ws = new WebSocket(wsUrl(server, token));
      clients.push(ws);
      await waitForOpen(ws);

      // 3 ciclos de heartbeat — o cliente ws responde a ping com pong
      // automaticamente (comportamento nativo do protocolo, embutido na
      // lib em ambos os lados), então a conexão deve permanecer aberta.
      await new Promise((resolve) => setTimeout(resolve, 30 * 3 + 20));

      expect(ws.readyState).toBe(WebSocket.OPEN);

      // e continua recebendo eventos normalmente depois disso
      const message = waitForMessage(ws);
      notifyStore('store-saudavel', { type: 'delivery:updated', event: 'accepted', delivery: { _id: 'd3' } });
      await expect(message).resolves.toEqual({
        type: 'delivery:updated',
        event: 'accepted',
        delivery: { _id: 'd3' },
      });
    });

    it('derruba (terminate) uma conexão zumbi que não respondeu ao ping do ciclo anterior', async () => {
      ({ server, wss } = await startServer({ heartbeatIntervalMs: 30 }));
      const token = jsonwebtoken.sign({ storeId: 'store-zumbi' }, process.env.JWT_SECRET_STORE);

      const ws = new WebSocket(wsUrl(server, token));
      clients.push(ws);
      await waitForOpen(ws);

      // Simula uma conexão que já está morta do ponto de vista da rede,
      // mas que o processo Node ainda não descobriu (readyState continua
      // OPEN) — exatamente o cenário de um proxy derrubando a conexão
      // silenciosamente. Força isAlive=false direto no socket do lado do
      // servidor, como se o ciclo de ping anterior não tivesse recebido
      // pong nenhum.
      const serverSideSocket = [...wss.clients][0];
      serverSideSocket.isAlive = false;

      // No próximo tick do heartbeat, essa conexão deve ser terminada.
      const closeCode = await waitForClose(ws);
      expect(closeCode).toBeDefined();

      // E, uma vez removida, notifyStore não deve mais achar ninguém pra
      // essa loja (ela já foi tirada de storeSockets via 'close').
      let received = false;
      ws.on('message', () => {
        received = true;
      });
      notifyStore('store-zumbi', { type: 'delivery:updated', event: 'delivered', delivery: {} });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(received).toBe(false);
    });
  });
});