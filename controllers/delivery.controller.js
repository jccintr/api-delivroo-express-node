import Store from '../models/store.js';
import Delivery from '../models/delivery.js';
import { distanceBetween } from '../utils/googleMaps.js';
import { buildStoreAddressText } from '../utils/address.js';

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
      package: {
        description: pkg.description,
        category: pkg.category,
        quantity: pkg.quantity,
        weight: pkg.weight,
        declaredvalue: pkg.declaredvalue,
        notes: pkg.notes,
        payment: pkg.payment,
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