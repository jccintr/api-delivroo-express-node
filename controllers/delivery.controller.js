import Store from '../models/store.js';
import Delivery from '../models/delivery.js';
import Rider from '../models/rider.js';
import { distanceBetween } from '../utils/googleMaps.js';
import { buildStoreAddressText } from '../utils/address.js';
import { notifyStore } from '../websocket.js';


// TODO: substituir por um cálculo real (baseado em distância, categoria do
// pacote, demanda/hora, taxa mínima etc.) quando essa regra de negócio for
// definida. Por enquanto gera um valor aleatório só para termos o dado
// preenchido e podermos avançar no front do rider.
function calculateRiderPayout() {
  const MIN_PAYOUT = 6;
  const MAX_PAYOUT = 25;
  const value = MIN_PAYOUT + Math.random() * (MAX_PAYOUT - MIN_PAYOUT);
  return Math.round(value * 100) / 100;
}

// POST /stores/deliveries
// Cria uma nova entrega para a loja autenticada. Nenhum rider é atribuído
// neste momento (fica como null, para atribuição/aceite posterior).
//
// O destino já chega com latitude/longitude (obtidas no front via Google
// Places Autocomplete + Place Details). A distância é calculada usando as
// coordenadas de origem (loja) e destino diretamente — mais preciso e sem
// depender de geocodificação por texto.
export const createDelivery = async (req, res) => {
  try {
    const storeId = req.user?.id;
    const { destino, package: pkg } = req.body;

    const store = await Store.findById(storeId).select('name address emailVerifiedAt active');

    if (!store) {
      return res.status(404).json({ error: 'Loja não encontrada.' });
    }

    if (!store.active) {
      return res.status(403).json({ error: 'Conta desativada.' });
    }

    if (!store.emailVerifiedAt) {
      return res.status(403).json({ error: 'Conta ainda não verificada.' });
    }

    const origemAddress = buildStoreAddressText(store.address);
    const { latitude: origemLat, longitude: origemLng } = store.address ?? {};

    if (!origemAddress || origemLat == null || origemLng == null) {
      return res.status(400).json({
        error: 'Cadastre o endereço completo da loja (com localização) antes de criar uma entrega.',
      });
    }

    let distanceInfo;
    try {
      distanceInfo = await distanceBetween(
        `${origemLat},${origemLng}`,
        `${destino.latitude},${destino.longitude}`,
      );
    } catch (error) {
      console.error('Erro ao calcular distância da entrega:', error);
      return res.status(422).json({
        error: 'Não foi possível calcular a distância para o endereço informado. Verifique o endereço e tente novamente.',
      });
    }

    const delivery = new Delivery({
      store: storeId,
      rider: null,
      origem: {
        address: origemAddress,
        latitude: origemLat,
        longitude: origemLng,
      },
      destino: {
        address: destino.address,
        latitude: destino.latitude,
        longitude: destino.longitude,
        nome: destino.nome,
        telefone: destino.telefone,
      },
      // distancia é armazenada em quilômetros, com 2 casas decimais
      distancia: Math.round((distanceInfo.meters / 1000) * 100) / 100,
      riderPayout: calculateRiderPayout(),
      package: {
        description: pkg.description,
        category: pkg.category,
        quantity: pkg.quantity,
        weight: pkg.weight,
        declaredvalue: pkg.declaredvalue,
        notes: pkg.notes,
        payment: pkg.payment,
        amountDue: pkg.amountDue,
        cashChange: pkg.cashChange,
      },
      events: [{ data: new Date(), descricao: 'Entrega criada pela loja' }],
    });

    await delivery.save();

    return res.status(201).json(delivery);
  } catch (error) {
    console.error('Erro no createDelivery:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// Verifica se o rider existe e está apto a ver/aceitar entregas (ativo,
// e-mail verificado, conta aprovada). Usado tanto em listAvailableDeliveries
// quanto em getDelivery para não duplicar essa checagem em cada endpoint.
async function findEligibleRider(riderId) {
  const rider = await Rider.findById(riderId).select('name active emailVerifiedAt accountApprovedAt');

  if (!rider) {
    return { error: 'Entregador não encontrado.', status: 404 };
  }

  if (!rider.active) {
    return { error: 'Conta desativada.', status: 403 };
  }

  if (!rider.emailVerifiedAt) {
    return { error: 'Conta ainda não verificada.', status: 403 };
  }

  if (!rider.accountApprovedAt) {
    return { error: 'Conta ainda não aprovada.', status: 403 };
  }

  return { rider };
}

// GET /riders/deliveries/available
// Lista entregas com status "disponível" (status: 0) e sem rider atribuído,
// para o app do entregador exibir na tela principal. Inclui os dados da
// loja (nome, telefone, avatar) para o rider saber quem está solicitando.
export const listAvailableDeliveries = async (req, res) => {
  try {
    const riderId = req.user?.id;

    const { rider, error, status } = await findEligibleRider(riderId);
    if (!rider) {
      return res.status(status).json({ error });
    }

    const deliveries = await Delivery.find({ status: 0, rider: null })
      .populate('store', 'name avatar address.district')
      .sort({ createdAt: -1 })
      .limit(50); // evita payload gigante se acumular muita entrega parada

    return res.status(200).json(deliveries);
  } catch (error) {
    console.error('Erro no listAvailableDeliveries:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// GET /riders/deliveries/active
// Lista as entregas do próprio rider que estão em andamento (status 1, 2
// ou 3 — aceita, retirada, a caminho), para a tela Home exibir junto com
// as disponíveis. Hoje um rider só deve ter uma entrega ativa por vez (ver
// acceptDelivery), mas a rota já devolve uma lista pensando em, no futuro,
// permitir múltiplas entregas simultâneas sem precisar mudar o contrato.
export const listActiveDeliveries = async (req, res) => {
  try {
    const riderId = req.user?.id;

    const { rider, error, status } = await findEligibleRider(riderId);
    if (!rider) {
      return res.status(status).json({ error });
    }

    const deliveries = await Delivery.find({ rider: riderId, status: { $in: [1, 2, 3] } })
      .populate('store', 'name avatar address.district')
      .sort({ acceptedAt: -1 });

    return res.status(200).json(deliveries);
  } catch (error) {
    console.error('Erro no listActiveDeliveries:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// GET /riders/deliveries/:id
// Detalhes de uma entrega específica, para a tela de "Detalhes da entrega"
// (exibida ao tocar num card da lista de disponíveis), antes do rider
// decidir se aceita.
//
// Regra de visibilidade:
// - status 0 e sem rider atribuído → entrega "disponível", qualquer rider
//   elegível pode ver os detalhes (é o caso de pré-visualização, vindo da
//   lista de disponíveis).
// - status > 0 (já aceita) → só o rider atribuído a ela pode ver. Depois
//   que uma entrega é aceita, ela deixa de ser pública para os demais.
export const getDelivery = async (req, res) => {
  try {
    const riderId = req.user?.id;
    const { id } = req.params;

    const { rider, error, status } = await findEligibleRider(riderId);
    if (!rider) {
      return res.status(status).json({ error });
    }

    const delivery = await Delivery.findById(id).populate('store', 'name avatar address.district');

    if (!delivery) {
      return res.status(404).json({ error: 'Entrega não encontrada.' });
    }

    const isAvailable = delivery.status === 0 && delivery.rider == null;
    const isOwnDelivery = delivery.rider != null && delivery.rider.equals(riderId);

    if (!isAvailable && !isOwnDelivery) {
      return res.status(403).json({ error: 'Você não tem permissão para ver esta entrega.' });
    }

    return res.status(200).json(delivery);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ error: 'Entrega não encontrada.' });
    }
    console.error('Erro no getDelivery:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// Helper comum a todas as transições de status feitas pelo rider: valida
// elegibilidade, aplica um update atômico condicionado ao status/rider
// atuais esperados (evita corrida entre requisições concorrentes e pulos de
// etapa) e devolve a entrega já populada, ou o motivo do erro.
//
// `filter` deve sempre conter pelo menos `status` (e, exceto no aceite,
// `rider: riderId`) para garantir que a transição só aconteça a partir do
// estado esperado.


// ... (código existente sem mudanças até chegar em transitionAsRider) ...

async function transitionAsRider({ riderId, deliveryId, filter, update, conflictMessage, notifyEvent }) {
  const { rider, error, status } = await findEligibleRider(riderId);
  if (!rider) {
    return { error, status };
  }

  const delivery = await Delivery.findOneAndUpdate(
    { _id: deliveryId, ...filter },
    update,
    { returnDocument: 'after' },
  ).populate('store', 'name avatar address.district');

  if (!delivery) {
    // O findOneAndUpdate acima retorna null tanto quando a entrega não
    // existe quanto quando existe mas está num status diferente do
    // esperado — precisamos diferenciar os dois pra dar o erro certo.
    // Essa checagem extra só roda no caminho de falha, então não reabre
    // a janela de corrida da transição em si (que já é atômica acima).
    const exists = await Delivery.exists({ _id: deliveryId });
    if (!exists) {
      return { error: 'Entrega não encontrada.', status: 404 };
    }
    return { error: conflictMessage, status: 409 };
  }

  // Avisa o painel da loja em tempo real (via WebSocket) que essa entrega
  // mudou. Se a loja não estiver com o dashboard aberto no momento, a
  // notificação simplesmente não tem destinatário — não é um erro, ela vê
  // o estado atualizado na próxima vez que abrir/atualizar a tela.
  //
  // Importante: buscamos uma cópia separada da entrega, com o rider
  // populado, só para esse payload. O `delivery` retornado abaixo é o que
  // a resposta REST devolve para o próprio rider — e essa resposta sempre
  // trouxe `rider` como o ID simples (não populado), então não podemos
  // popular o objeto original sem quebrar esse contrato já existente.
  if (notifyEvent && delivery.store) {
    const deliveryForStore = await Delivery.findById(delivery._id)
      .populate('store', 'name avatar address.district')
      .populate('rider', 'name phone avatar vehicle rating');

    notifyStore(delivery.store._id, {
      type: 'delivery:updated',
      event: notifyEvent,
      delivery: deliveryForStore,
    });
  }

  return { delivery };
}
// POST /riders/deliveries/:id/accept
// status 0 (disponível) → 1 (aceita). Só funciona se ninguém tiver
// aceitado entre o rider ver os detalhes e tocar em "Aceitar" — é isso que
// o filtro { status: 0, rider: null } garante de forma atômica.
export const acceptDelivery = async (req, res) => {
  try {
    const riderId = req.user?.id;
    const { id } = req.params;

    const { delivery, error, status } = await transitionAsRider({
      riderId,
      deliveryId: id,
      filter: { status: 0, rider: null },
      update: {
        status: 1,
        rider: riderId,
        acceptedAt: new Date(),
        $push: { events: { data: new Date(), descricao: 'Entrega aceita pelo entregador' } },
      },
      conflictMessage: 'Esta entrega não está mais disponível.',
      notifyEvent: 'accepted',
    });

    if (!delivery) {
      return res.status(status).json({ error });
    }

    return res.status(200).json(delivery);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ error: 'Entrega não encontrada.' });
    }
    console.error('Erro no acceptDelivery:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// POST /riders/deliveries/:id/pickup
// status 1 (aceita) → 2 (retirada). Só o rider que aceitou pode confirmar.
export const pickupDelivery = async (req, res) => {
  try {
    const riderId = req.user?.id;
    const { id } = req.params;

    const { delivery, error, status } = await transitionAsRider({
      riderId,
      deliveryId: id,
      filter: { status: 1, rider: riderId },
      update: {
        status: 2,
        pickedUpAt: new Date(),
        $push: { events: { data: new Date(), descricao: 'Pacote retirado pelo entregador' } },
      },
      conflictMessage: 'Não foi possível confirmar a retirada desta entrega.',
      notifyEvent: 'picked-up',
    });

    if (!delivery) {
      return res.status(status).json({ error });
    }

    return res.status(200).json(delivery);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ error: 'Entrega não encontrada.' });
    }
    console.error('Erro no pickupDelivery:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// POST /riders/deliveries/:id/en-route
// status 2 (retirada) → 3 (a caminho do destino).
export const dispatchDelivery = async (req, res) => {
  try {
    const riderId = req.user?.id;
    const { id } = req.params;

    const { delivery, error, status } = await transitionAsRider({
      riderId,
      deliveryId: id,
      filter: { status: 2, rider: riderId },
      update: {
        status: 3,
        dispatchedAt: new Date(),
        $push: { events: { data: new Date(), descricao: 'Entregador a caminho do destino' } },
      },
      conflictMessage: 'Não foi possível atualizar esta entrega.',
      notifyEvent: 'dispatched',
    });

    if (!delivery) {
      return res.status(status).json({ error });
    }

    return res.status(200).json(delivery);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ error: 'Entrega não encontrada.' });
    }
    console.error('Erro no dispatchDelivery:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// POST /riders/deliveries/:id/deliver
// status 3 (a caminho) → 4 (entregue). Estado final de sucesso.
export const deliverDelivery = async (req, res) => {
  try {
    const riderId = req.user?.id;
    const { id } = req.params;

    const { delivery, error, status } = await transitionAsRider({
      riderId,
      deliveryId: id,
      filter: { status: 3, rider: riderId },
      update: {
        status: 4,
        deliveredAt: new Date(),
        $push: { events: { data: new Date(), descricao: 'Pacote entregue' } },
      },
      conflictMessage: 'Não foi possível confirmar a entrega deste pacote.',
      notifyEvent: 'delivered',
    });

    if (!delivery) {
      return res.status(status).json({ error });
    }

    return res.status(200).json(delivery);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ error: 'Entrega não encontrada.' });
    }
    console.error('Erro no deliverDelivery:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// POST /riders/deliveries/:id/return
// status 2 ou 3 (pacote já em posse do rider) → 5 (devolvida à loja).
// Usado quando o cliente recusa/não é encontrado etc. Exige `motivo`.
export const returnDelivery = async (req, res) => {
  try {
    const riderId = req.user?.id;
    const { id } = req.params;
    const { motivo } = req.body;

    const { delivery, error, status } = await transitionAsRider({
      riderId,
      deliveryId: id,
      filter: { status: { $in: [2, 3] }, rider: riderId },
      update: {
        status: 5,
        cancelReason: motivo,
        $push: { events: { data: new Date(), descricao: `Pacote devolvido à loja: ${motivo}` } },
      },
      conflictMessage: 'Não foi possível registrar a devolução desta entrega.',
      notifyEvent: 'returned',
    });

    if (!delivery) {
      return res.status(status).json({ error });
    }

    return res.status(200).json(delivery);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ error: 'Entrega não encontrada.' });
    }
    console.error('Erro no returnDelivery:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// POST /riders/deliveries/:id/cancel
// status 1 (aceita, ainda NÃO retirada) → volta para 0, com rider: null.
// Cancelamento do rider antes de pegar o pacote não é um estado terminal:
// a entrega reabre no pool para outro rider aceitar, em vez de forçar a
// loja a recriar tudo do zero. Depois da retirada (status 2/3), o rider já
// não pode mais "cancelar" — o caminho correto nesse ponto é /return.
export const cancelDeliveryByRider = async (req, res) => {
  try {
    const riderId = req.user?.id;
    const { id } = req.params;
    const { motivo } = req.body;

    const { delivery, error, status } = await transitionAsRider({
      riderId,
      deliveryId: id,
      filter: { status: 1, rider: riderId },
      update: {
        status: 0,
        rider: null,
        acceptedAt: null,
        $push: { events: { data: new Date(), descricao: `Entrega cancelada pelo entregador: ${motivo}` } },
      },
      conflictMessage: 'Não foi possível cancelar esta entrega.',
      notifyEvent: 'cancelled_by_rider',
    });

    if (!delivery) {
      return res.status(status).json({ error });
    }

    return res.status(200).json(delivery);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ error: 'Entrega não encontrada.' });
    }
    console.error('Erro no cancelDeliveryByRider:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// GET /stores/deliveries/active
// Lista as entregas da loja autenticada que ainda estão em andamento
// (status 0, 1, 2 ou 3 — solicitada, aceita, retirada ou a caminho), para
// a loja acompanhar o que falta ser concluído. Entregas em estado final
// (4 entregue, 5 devolvida, 6 cancelada) não aparecem aqui. Quando já
// houver rider atribuído, seus dados básicos vêm populados para a loja
// saber quem está com o pacote.
export const listStoreActiveDeliveries = async (req, res) => {
  try {
    const storeId = req.user?.id;

    const store = await Store.findById(storeId).select('name active emailVerifiedAt');

    if (!store) {
      return res.status(404).json({ error: 'Loja não encontrada.' });
    }

    if (!store.active) {
      return res.status(403).json({ error: 'Conta desativada.' });
    }

    if (!store.emailVerifiedAt) {
      return res.status(403).json({ error: 'Conta ainda não verificada.' });
    }

    const deliveries = await Delivery.find({ store: storeId, status: { $in: [0, 1, 2, 3] } })
      .populate('rider', 'name phone avatar vehicle rating')
      .sort({ createdAt: -1 });

    return res.status(200).json(deliveries);
  } catch (error) {
    console.error('Erro no listStoreActiveDeliveries:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// Mapeia o filtro de status amigável da query string pro código numérico
// persistido no banco (ver comentário de status em models/delivery.js).
const HISTORY_STATUS_CODES = {
  delivered: 4,
  returned: 5,
  cancelled: 6,
};

// GET /stores/deliveries/history
// Lista as entregas da loja autenticada que já chegaram a um estado final
// (entregue, devolvida ou cancelada pela loja) — o espelho de
// listStoreActiveDeliveries, mas para o que já aconteceu. Como esse
// conjunto só cresce com o tempo, é sempre paginado e aceita filtros por
// status e por período (createdAt).
//
// Query params (todos opcionais):
//   status: 'delivered' | 'returned' | 'cancelled' — default: todos os 3
//   from, to: datas (AAAA-MM-DD) que delimitam createdAt
//   page: página, começando em 1 (default 1)
//   limit: itens por página, 1-100 (default 20)
export const listStoreDeliveryHistory = async (req, res) => {
  try {
    const storeId = req.user?.id;

    const store = await Store.findById(storeId).select('name active emailVerifiedAt');

    if (!store) {
      return res.status(404).json({ error: 'Loja não encontrada.' });
    }

    if (!store.active) {
      return res.status(403).json({ error: 'Conta desativada.' });
    }

    if (!store.emailVerifiedAt) {
      return res.status(403).json({ error: 'Conta ainda não verificada.' });
    }

    const { status, from, to } = req.query;
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;

    const filter = {
      store: storeId,
      status: status ? HISTORY_STATUS_CODES[status] : { $in: Object.values(HISTORY_STATUS_CODES) },
    };

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = from;
      if (to) {
        // `to` já vem convertido para Date pelo validator (00:00 UTC do
        // dia), e a loja espera que o dia final seja inclusivo — por isso
        // vai até o fim do dia (23:59:59.999) em vez de parar na meia-noite.
        // Usa setUTCHours (não setHours) para não depender do fuso horário
        // do servidor — o `from` também é interpretado em UTC pelo
        // toDate() do validator, então os dois extremos do range precisam
        // usar a mesma referência de fuso.
        const endOfDay = new Date(to);
        endOfDay.setUTCHours(23, 59, 59, 999);
        filter.createdAt.$lte = endOfDay;
      }
    }

    const skip = (page - 1) * limit;

    const [deliveries, total] = await Promise.all([
      Delivery.find(filter)
        .populate('rider', 'name phone avatar vehicle rating')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Delivery.countDocuments(filter),
    ]);

    return res.status(200).json({
      data: deliveries,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error('Erro no listStoreDeliveryHistory:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// POST /stores/deliveries/:id/cancel
// status 0 ou 1 (ainda sem pacote retirado) → 6, cancelada pela loja.
// Depois que o rider já retirou o pacote (status 2+), a loja não pode mais
// cancelar por aqui — nesse ponto quem decide é o rider (/return).
export const cancelDeliveryByStore = async (req, res) => {
  try {
    const storeId = req.user?.id;
    const { id } = req.params;
    const { motivo } = req.body;

    const store = await Store.findById(storeId).select('name active emailVerifiedAt');

    if (!store) {
      return res.status(404).json({ error: 'Loja não encontrada.' });
    }

    if (!store.active) {
      return res.status(403).json({ error: 'Conta desativada.' });
    }

    if (!store.emailVerifiedAt) {
      return res.status(403).json({ error: 'Conta ainda não verificada.' });
    }

        const delivery = await Delivery.findOneAndUpdate(
      { _id: id, store: storeId, status: { $in: [0, 1] } },
      {
        status: 6,
        cancelReason: motivo,
        // Mantemos o rider gravado (se havia um) como registro histórico de
        // quem tinha aceitado quando a loja cancelou — não zeramos aqui.
        $push: { events: { data: new Date(), descricao: `Entrega cancelada pela loja: ${motivo}` } },
      },
      { returnDocument: 'after' },
    );

    if (!delivery) {
      // Mesmo raciocínio do transitionAsRider: só investiga o motivo exato
      // da falha aqui no caminho de erro, sem comprometer a atomicidade do
      // update acima.
      const existing = await Delivery.findById(id).select('store status');

      if (!existing) {
        return res.status(404).json({ error: 'Entrega não encontrada.' });
      }

      if (existing.store.toString() !== storeId) {
        return res.status(403).json({ error: 'Você não tem permissão para cancelar esta entrega.' });
      }

      return res.status(409).json({ error: 'Não foi possível cancelar esta entrega.' });
    }

    // TODO: quando o rider já tinha aceitado (status era 1), notificá-lo
    // (push) de que a loja cancelou a entrega em andamento.

    return res.status(200).json(delivery);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ error: 'Entrega não encontrada.' });
    }
    console.error('Erro no cancelDeliveryByStore:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};