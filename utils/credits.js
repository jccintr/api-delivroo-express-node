import Store from '../models/store.js';
import Delivery from '../models/delivery.js';
import CreditTransaction from '../models/creditTransaction.js';

// Entregas "em aberto": ainda podem ser concluídas e, portanto, vão consumir
// saldo. Status 0 a 3 (ver models/delivery.js).
const OPEN_DELIVERY_STATUSES = [0, 1, 2, 3];

export const isDuplicateKeyError = (error) => error?.code === 11000;

// Quanto a loja ainda pode usar: entregas grátis da promoção + entregas
// compradas. `availableToRequest` desconta as entregas que já estão em
// andamento (pedidas e ainda não concluídas), porque elas vão gastar saldo
// quando terminarem — é esse número que decide se dá para pedir mais uma.
export async function getStoreBalance(storeId) {
  const store = await Store.findById(storeId).select('freeDeliveriesRemaining deliveryCredits');
  if (!store) return null;

  const free = store.freeDeliveriesRemaining ?? 0;
  const purchased = store.deliveryCredits ?? 0;
  const openDeliveries = await Delivery.countDocuments({
    store: storeId,
    status: { $in: OPEN_DELIVERY_STATUSES },
  });

  const available = free + purchased;
  return {
    free,
    purchased,
    available,
    openDeliveries,
    availableToRequest: Math.max(0, available - openDeliveries),
  };
}

// Soma créditos ao saldo comprado e registra no extrato. Usado quando o
// admin confirma uma recarga e nos ajustes manuais positivos.
// Se a movimentação já foi registrada (índice único em recharge), não
// credita de novo e devolve { duplicate: true }.
export async function grantCredits({ storeId, amount, type, recharge = null, admin = null, note = null }) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Quantidade de créditos inválida');
  }

  if (recharge) {
    const already = await CreditTransaction.exists({ recharge, type: 'purchase' });
    if (already) return { duplicate: true };
  }

  const store = await Store.findByIdAndUpdate(
    storeId,
    { $inc: { deliveryCredits: amount } },
    { returnDocument: 'after' },
  );
  if (!store) throw new Error('Loja não encontrada');

  try {
    await CreditTransaction.create({
      store: storeId,
      type,
      delta: amount,
      balanceAfter: store.deliveryCredits,
      recharge,
      admin,
      note,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      // Outra requisição já creditou esta recarga: desfaz o incremento.
      await Store.findByIdAndUpdate(storeId, { $inc: { deliveryCredits: -amount } });
      return { duplicate: true };
    }
    throw error;
  }

  return { duplicate: false, balance: store.deliveryCredits };
}

// Tira 1 crédito comprado, de forma atômica (o filtro $gt:0 impede duas
// entregas concluídas ao mesmo tempo de gastarem o mesmo crédito). Devolve
// null quando não há saldo.
export async function consumeCredit({ storeId, deliveryId }) {
  const store = await Store.findOneAndUpdate(
    { _id: storeId, deliveryCredits: { $gt: 0 } },
    { $inc: { deliveryCredits: -1 } },
    { returnDocument: 'after' },
  );
  if (!store) return null;

  try {
    await CreditTransaction.create({
      store: storeId,
      type: 'delivery',
      delta: -1,
      balanceAfter: store.deliveryCredits,
      delivery: deliveryId,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      // Esta entrega já consumiu um crédito antes: devolve o que foi tirado.
      await Store.findByIdAndUpdate(storeId, { $inc: { deliveryCredits: 1 } });
      return { duplicate: true };
    }
    throw error;
  }

  return { duplicate: false, balance: store.deliveryCredits };
}

// Ajuste manual do admin (positivo ou negativo). Não deixa o saldo ficar
// abaixo de zero. Devolve null se o ajuste negativo passaria do saldo.
export async function adjustCredits({ storeId, delta, admin, note }) {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error('Ajuste inválido');
  }

  const filter = delta < 0 ? { _id: storeId, deliveryCredits: { $gte: -delta } } : { _id: storeId };
  const store = await Store.findOneAndUpdate(filter, { $inc: { deliveryCredits: delta } }, { returnDocument: 'after' });
  if (!store) return null;

  await CreditTransaction.create({
    store: storeId,
    type: 'adjustment',
    delta,
    balanceAfter: store.deliveryCredits,
    admin,
    note,
  });

  return { balance: store.deliveryCredits };
}
