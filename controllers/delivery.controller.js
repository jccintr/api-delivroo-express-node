import Store from '../models/store.js';
import Delivery from '../models/delivery.js';
import Rider from '../models/rider.js';
import { distanceBetween } from '../utils/googleMaps.js';
import { buildStoreAddressText } from '../utils/address.js';

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

// GET /riders/deliveries/:id
// Detalhes de uma entrega específica, para a tela de "Detalhes da entrega"
// (exibida ao tocar num card da lista de disponíveis), antes do rider
// decidir se aceita. Não restringe por status/rider aqui — a checagem de
// "ainda está disponível" é feita no momento do aceite (evita corrida entre
// vários riders vendo a mesma entrega ao mesmo tempo), então esta rota
// serve tanto para pré-visualizar uma entrega disponível quanto para
// reabrir os detalhes de uma que o próprio rider já aceitou.
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

    return res.status(200).json(delivery);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ error: 'Entrega não encontrada.' });
    }
    console.error('Erro no getDelivery:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};