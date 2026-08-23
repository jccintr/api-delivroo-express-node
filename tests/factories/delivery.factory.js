import Delivery from '../../models/delivery.js';
import {createStore} from './store.factory.js';

export async function createDelivery(overrides = {}) {
   const store = await createStore();
   const delivery = await Delivery.create({
       "store": store._id,
       "destino": {
            "nome": "Maria Souza",
            "telefone": "(35) 98765-4321",
            "address": "Rua Altino Rosa, 123, Horizonte Azul, Brazópolis - MG",
            "latitude": -23.5615,
            "longitude": -46.6563
        },
        "package": {
            "description": "2 lanches + refrigerante",
            "category": "Comida",
            "quantity": 2,
            "weight": 1.2,
            "declaredvalue": 45.90,
            "notes": "Entregar no portão dos fundos",
            "payment": "Dinheiro",
            "cashChange": 4.10,
            "amountDue" : 36
        },
        distancia: 1.2,
        riderPayout: 6,
        ...overrides
    });

    return delivery;
}

// tests/factories/delivery.factory.js
export function createDeliveryPayload(overrides = {}) {
  return {
    destino: {
      nome: 'Maria Souza',
      telefone: '(35) 98765-4321',
      address: 'Rua Altino Rosa, 123, Horizonte Azul, Brazópolis - MG',
      latitude: -22.47402936600101,
      longitude: -45.60976238305542,
      ...(overrides.destino || {}),
    },
    package: {
      description: '2 lanches + refrigerante',
      category: 'Comida',
      quantity: 2,
      weight: 1.2,
      declaredvalue: 45.9,
      notes: 'Entregar no portão dos fundos',
      payment: 'Dinheiro',
      cashChange: 4.1,
      amountDue: 36,
      ...(overrides.package || {}),
    },
    ...overrides,
    // garante que destino/package mesclados acima não sejam sobrescritos por spreads rasos errados
    destino: {
      nome: 'Maria Souza',
      telefone: '(35) 98765-4321',
      address: 'Rua Altino Rosa, 123, Horizonte Azul, Brazópolis - MG',
      latitude: -22.47402936600101,
      longitude: -45.60976238305542,
      ...(overrides.destino || {}),
    },
    package: {
      description: '2 lanches + refrigerante',
      category: 'Comida',
      quantity: 2,
      weight: 1.2,
      declaredvalue: 45.9,
      notes: 'Entregar no portão dos fundos',
      payment: 'Dinheiro',
      cashChange: 4.1,
      amountDue: 36,
      ...(overrides.package || {}),
    },
  };
}