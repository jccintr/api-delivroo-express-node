import Rider from '../models/rider.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// A API da Expo aceita no máximo 100 mensagens por request — precisa
// quebrar em lotes na mão nesse caso (sem SDK, é só isso mesmo).
const MAX_MESSAGES_PER_REQUEST = 100;

// Mesmo formato aceito nos dois nomes que a Expo já usou pro SDK
// (ExponentPushToken[...] mais antigo, ExpoPushToken[...] mais novo).
const EXPO_PUSH_TOKEN_REGEX = /^Expo(nent)?PushToken\[.+\]$/;

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// EXPO_ACCESS_TOKEN é opcional: só necessário se a "Enhanced Push
// Security" estiver ativada no dashboard da EAS (Credentials > Push
// Security). Sem isso configurado, o envio funciona normalmente sem token.
function buildHeaders() {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }
  return headers;
}

// Monta as mensagens, filtra tokens com formato inválido (não bloqueia o
// envio dos demais por causa de um token corrompido) e envia em lotes de
// até 100 (limite documentado da API da Expo).
//
// Também cuida do caso mais comum de token morto: quando o "ticket" de
// envio já vem com erro DeviceNotRegistered (o app foi desinstalado, ou a
// permissão de notificação foi revogada), limpa esse token do rider no
// banco — não vale a pena continuar tentando enviar pra ele.
//
// Não verifica os "receipts" (segunda etapa, ~15min depois, que pega mais
// casos de token morto) — isso ficaria bem como um job periódico separado
// se o volume de tokens inválidos começar a incomodar; por ora o
// ticket-level já cobre o caso mais comum e mantém isso simples.
export async function sendPushNotifications(messages) {
  const validMessages = messages.filter((message) => {
    if (EXPO_PUSH_TOKEN_REGEX.test(message.to)) return true;
    console.warn('Push ignorado — token com formato inválido:', message.to);
    return false;
  });

  if (validMessages.length === 0) return;

  const invalidTokens = [];

  for (const batch of chunk(validMessages, MAX_MESSAGES_PER_REQUEST)) {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(batch),
      });

      const { data: tickets } = await response.json();

      (tickets || []).forEach((ticket, index) => {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          invalidTokens.push(batch[index].to);
        }
      });
    } catch (error) {
      // Best-effort: uma falha ao notificar nunca deve derrubar o fluxo
      // principal (criar entrega, cancelar entrega) que disparou o push.
      console.error('Erro ao enviar lote de push notifications:', error);
    }
  }

  if (invalidTokens.length > 0) {
    await Rider.updateMany({ pushToken: { $in: invalidTokens } }, { pushToken: null });
  }
}

// Notifica todos os riders online e elegíveis (mesmos critérios de
// findEligibleRider em delivery.controller.js, mais online:true — só
// quem está de fato disponível pra pegar entrega) DA MESMA CIDADE DA LOJA
// sobre uma nova entrega. `storeName` é passado à parte porque, no ponto em
// que isso é chamado (logo após criar a entrega), `delivery.store` ainda é
// só o ObjectId — não populado — e o controller já tem o nome da loja em
// mãos. `delivery.city` já vem preenchido na criação (denormalizado da
// Store — ver createDelivery), então não precisa de lookup extra aqui.
export async function notifyNewDeliveryAvailable(delivery, storeName) {
  const riders = await Rider.find({
    online: true,
    active: true,
    emailVerifiedAt: { $ne: null },
    accountApprovedAt: { $ne: null },
    pushToken: { $ne: null },
    city: delivery.city,
  }).select('pushToken');

  if (riders.length === 0) return;

  const messages = riders.map((rider) => ({
    to: rider.pushToken,
    sound: 'default',
    title: 'Nova entrega disponível!',
    body: `${storeName || 'Uma loja'} — R$ ${delivery.riderPayout.toFixed(2).replace('.', ',')} — ${delivery.distancia} km`,
    data: { type: 'delivery_available', deliveryId: delivery._id.toString() },
  }));

  await sendPushNotifications(messages);
}

// Notifica um rider específico de que a loja cancelou uma entrega que ele
// já tinha aceitado.
export async function notifyRiderDeliveryCancelled(riderId, delivery) {
  const rider = await Rider.findById(riderId).select('pushToken');
  if (!rider?.pushToken) return;

  await sendPushNotifications([
    {
      to: rider.pushToken,
      sound: 'default',
      title: 'Entrega cancelada',
      body: `A loja cancelou a entrega para ${delivery.destino?.nome || 'o cliente'}.`,
      data: { type: 'delivery_cancelled', deliveryId: delivery._id.toString() },
    },
  ]);
}