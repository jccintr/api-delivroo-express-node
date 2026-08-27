import { WebSocketServer, WebSocket } from 'ws';
import jsonwebtoken from 'jsonwebtoken';
import url from 'url';

// storeId (string) -> Set<WebSocket>. Uma loja pode ter mais de uma conexão
// ao mesmo tempo (dashboard aberto em duas abas, por exemplo), por isso um
// Set em vez de uma única referência.
const storeSockets = new Map();

function registerStoreSocket(storeId, ws) {
  if (!storeSockets.has(storeId)) {
    storeSockets.set(storeId, new Set());
  }
  storeSockets.get(storeId).add(ws);
}

function unregisterStoreSocket(storeId, ws) {
  const sockets = storeSockets.get(storeId);
  if (!sockets) return;
  sockets.delete(ws);
  if (sockets.size === 0) {
    storeSockets.delete(storeId);
  }
}

// Envia um evento para todas as conexões abertas da loja informada.
// Não lança erro se a loja não estiver conectada no momento (dashboard
// fechado) — nesse caso simplesmente não há ninguém para notificar agora,
// a loja vê o estado atualizado na próxima vez que abrir/atualizar a tela.
export function notifyStore(storeId, event) {
  const sockets = storeSockets.get(String(storeId));
  if (!sockets || sockets.size === 0) return;

  const payload = JSON.stringify(event);
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

// Conexão autenticada por token de loja, passado via query string:
// ws(s)://<host>?token=<JWT_STORE>
// (mesmo token retornado no login REST da loja, POST /stores/login).
const websocket = (server) => {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const { query } = url.parse(req.url, true);
    const token = query.token;

    if (!token) {
      ws.close(4001, 'Token ausente');
      return;
    }

    let storeId;
    try {
      const decoded = jsonwebtoken.verify(token, process.env.JWT_SECRET_STORE);
      storeId = String(decoded.storeId);
    } catch (error) {
      ws.close(4001, 'Token inválido');
      return;
    }

    ws.storeId = storeId;
    registerStoreSocket(storeId, ws);

    ws.on('close', () => {
      unregisterStoreSocket(storeId, ws);
    });

    ws.on('error', () => {
      unregisterStoreSocket(storeId, ws);
    });
  });

  return wss;
};

export default websocket;