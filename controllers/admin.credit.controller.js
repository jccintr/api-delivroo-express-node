import { matchedData } from 'express-validator';
import Store from '../models/store.js';
import CreditPackage from '../models/creditPackage.js';
import RechargeOrder from '../models/rechargeOrder.js';
import CreditTransaction from '../models/creditTransaction.js';
import { adjustCredits, grantCredits } from '../utils/credits.js';
import { sendStoreRechargeConfirmedEmail, sendStoreRechargeRejectedEmail } from '../utils/sendEmailV2.js';
import { notifyAdmins, notifyStore } from '../websocket.js';

// Rotas do ADMIN: pacotes de entregas, fila de recargas e ajuste de saldo.

const serializePackage = (p) => ({
  id: String(p._id),
  name: p.name,
  deliveries: p.deliveries,
  price: p.price,
  unitPrice: Math.round((p.price / p.deliveries) * 100) / 100,
  active: p.active,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

const serializeAdminOrder = (order) => {
  const plain = typeof order.toObject === 'function' ? order.toObject() : order;
  const store = plain.store && plain.store._id ? plain.store : null;
  return {
    id: String(plain._id),
    code: plain.code,
    status: plain.status,
    package: plain.package,
    store: store
      ? { id: String(store._id), name: store.name, email: store.email, phone: store.phone }
      : { id: String(plain.store) },
    informedAt: plain.informedAt,
    payerNote: plain.payerNote,
    receiptUrl: plain.receiptUrl,
    confirmedAt: plain.confirmedAt,
    rejectedAt: plain.rejectedAt,
    rejectionReason: plain.rejectionReason,
    cancelledAt: plain.cancelledAt,
    createdAt: plain.createdAt,
  };
};

async function countsByStatus() {
  const [informed, pending] = await Promise.all([
    RechargeOrder.countDocuments({ status: 'informed' }),
    RechargeOrder.countDocuments({ status: 'pending' }),
  ]);
  return { informed, pending };
}

// ---------------------------------------------------------------- Pacotes

// GET /admin/credit-packages — todos, inclusive os desabilitados.
export const listPackages = async (req, res) => {
  try {
    const packages = await CreditPackage.find().sort({ deliveries: 1, price: 1 });
    return res.status(200).json({ data: packages.map(serializePackage) });
  } catch (error) {
    console.error('Erro no listPackages (admin):', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// POST /admin/credit-packages
export const createPackage = async (req, res) => {
  try {
    const { name, deliveries, price, active } = matchedData(req, { locations: ['body'] });
    const pkg = await CreditPackage.create({
      name,
      deliveries,
      price: Math.round(price * 100) / 100,
      active: active ?? true,
    });
    return res.status(201).json(serializePackage(pkg));
  } catch (error) {
    console.error('Erro no createPackage:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// PATCH /admin/credit-packages/:id — edita nome, quantidade, preço ou
// habilita/desabilita. Pedidos já criados não mudam (guardam cópia do pacote).
export const updatePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, deliveries, price, active } = matchedData(req, { locations: ['body'] });

    const update = {};
    if (name !== undefined) update.name = name;
    if (deliveries !== undefined) update.deliveries = deliveries;
    if (price !== undefined) update.price = Math.round(price * 100) / 100;
    if (active !== undefined) update.active = active;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
    }

    const pkg = await CreditPackage.findByIdAndUpdate(id, update, { returnDocument: 'after', runValidators: true });
    if (!pkg) return res.status(404).json({ error: 'Pacote não encontrado.' });

    return res.status(200).json(serializePackage(pkg));
  } catch (error) {
    console.error('Erro no updatePackage:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// DELETE /admin/credit-packages/:id
export const deletePackage = async (req, res) => {
  try {
    const pkg = await CreditPackage.findByIdAndDelete(req.params.id);
    if (!pkg) return res.status(404).json({ error: 'Pacote não encontrado.' });
    return res.status(200).json({ message: 'Pacote excluído.' });
  } catch (error) {
    console.error('Erro no deletePackage:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// ---------------------------------------------------------------- Recargas

// GET /admin/recharge-orders/summary
// Contadores para o destaque no painel: `informed` = lojas que disseram que
// pagaram e esperam conferência; `pending` = Pix gerado, ainda sem aviso.
export const getRechargeSummary = async (req, res) => {
  try {
    return res.status(200).json(await countsByStatus());
  } catch (error) {
    console.error('Erro no getRechargeSummary:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// GET /admin/recharge-orders?status=&store=&page=&limit=
// status aceita também "open" (= pending + informed). Os informados vêm
// primeiro, porque são os que precisam de ação.
export const listRechargeOrders = async (req, res) => {
  try {
    const { status, store, page = 1, limit = 20 } = matchedData(req, { locations: ['query'] });

    const filter = {};
    if (status === 'open') filter.open = true;
    else if (status) filter.status = status;
    if (store) filter.store = store;

    const [orders, total] = await Promise.all([
      RechargeOrder.find(filter)
        .populate('store', 'name email phone')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      RechargeOrder.countDocuments(filter),
    ]);

    const data = orders.map(serializeAdminOrder);
    // Dentro da página, os "informados" sobem para o topo.
    data.sort((a, b) => Number(b.status === 'informed') - Number(a.status === 'informed'));

    return res.status(200).json({
      data,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      counts: await countsByStatus(),
    });
  } catch (error) {
    console.error('Erro no listRechargeOrders (admin):', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// GET /admin/recharge-orders/:id
export const getRechargeOrder = async (req, res) => {
  try {
    const order = await RechargeOrder.findById(req.params.id).populate('store', 'name email phone');
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
    return res.status(200).json(serializeAdminOrder(order));
  } catch (error) {
    console.error('Erro no getRechargeOrder (admin):', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

const safely = async (label, fn) => {
  try {
    return await fn();
  } catch (error) {
    console.error(`${label}:`, error);
    return null;
  }
};

// POST /admin/recharge-orders/:id/confirm
// O admin conferiu o Pix no banco: credita as entregas na loja. Funciona a
// partir de "informed" ou de "pending" (o dinheiro pode ter chegado sem a loja
// ter clicado em "Já paguei"). A troca de status é atômica, então confirmar
// duas vezes nunca credita duas vezes.
export const confirmRechargeOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const before = await RechargeOrder.findOneAndUpdate(
      { _id: id, status: { $in: ['pending', 'informed'] } },
      { status: 'confirmed', open: false, confirmedAt: new Date(), confirmedBy: req.user.id },
      { returnDocument: 'before' },
    );

    if (!before) {
      const existing = await RechargeOrder.findById(id).select('status');
      if (!existing) return res.status(404).json({ error: 'Pedido não encontrado.' });
      return res.status(409).json({ error: `Este pedido já está ${statusLabel(existing.status)}.` });
    }

    let granted;
    try {
      granted = await grantCredits({
        storeId: before.store,
        amount: before.package.deliveries,
        type: 'purchase',
        recharge: before._id,
        admin: req.user.id,
        note: `Recarga ${before.code} — ${before.package.name}`,
      });
    } catch (error) {
      // Não conseguiu creditar: volta o pedido ao estado anterior para o
      // admin poder tentar de novo, sem perder o pedido nem creditar pela metade.
      console.error('Erro ao creditar recarga, revertendo status:', error);
      await RechargeOrder.updateOne(
        { _id: before._id, status: 'confirmed' },
        { status: before.status, open: true, confirmedAt: null, confirmedBy: null },
      ).catch((revertError) => console.error('Erro ao reverter pedido:', revertError));
      return res.status(500).json({ error: 'Não foi possível creditar as entregas. Tente confirmar novamente.' });
    }

    const [order, store] = await Promise.all([
      RechargeOrder.findById(before._id).populate('store', 'name email phone'),
      Store.findById(before.store).select('name email freeDeliveriesRemaining deliveryCredits'),
    ]);

    const balance = (store?.freeDeliveriesRemaining ?? 0) + (store?.deliveryCredits ?? 0);

    if (!granted.duplicate) {
      await safely('Erro ao enviar e-mail de recarga confirmada', () =>
        sendStoreRechargeConfirmedEmail(store.email, {
          name: store.name,
          packageName: before.package.name,
          deliveries: before.package.deliveries,
          balance,
        }),
      );
    }

    safely('Erro ao notificar loja', () =>
      notifyStore(before.store, {
        type: 'credits:updated',
        reason: 'recharge_confirmed',
        order: { id: String(before._id), code: before.code, status: 'confirmed' },
        credits: { free: store?.freeDeliveriesRemaining ?? 0, purchased: store?.deliveryCredits ?? 0, available: balance },
      }),
    );
    safely('Erro ao notificar admins', () =>
      notifyAdmins({ type: 'recharge:resolved', order: { id: String(before._id), status: 'confirmed' } }),
    );

    return res.status(200).json(serializeAdminOrder(order));
  } catch (error) {
    console.error('Erro no confirmRechargeOrder:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

const statusLabel = (status) =>
  ({ pending: 'aguardando pagamento', informed: 'informado', confirmed: 'confirmado', rejected: 'recusado', cancelled: 'cancelado' })[status] ?? status;

// POST /admin/recharge-orders/:id/reject  { reason }
// O admin não encontrou o pagamento (ou ele não bate). Nenhum crédito é
// liberado; a loja recebe o motivo por e-mail e pode gerar outro pedido.
export const rejectRechargeOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = matchedData(req, { locations: ['body'] });

    const order = await RechargeOrder.findOneAndUpdate(
      { _id: id, status: { $in: ['pending', 'informed'] } },
      { status: 'rejected', open: false, rejectedAt: new Date(), rejectedBy: req.user.id, rejectionReason: reason },
      { returnDocument: 'after' },
    );

    if (!order) {
      const existing = await RechargeOrder.findById(id).select('status');
      if (!existing) return res.status(404).json({ error: 'Pedido não encontrado.' });
      return res.status(409).json({ error: `Este pedido já está ${statusLabel(existing.status)}.` });
    }

    const store = await Store.findById(order.store).select('name email');
    if (store) {
      await safely('Erro ao enviar e-mail de recarga recusada', () =>
        sendStoreRechargeRejectedEmail(store.email, { name: store.name, code: order.code, reason }),
      );
    }

    safely('Erro ao notificar loja', () =>
      notifyStore(order.store, {
        type: 'credits:updated',
        reason: 'recharge_rejected',
        order: { id: String(order._id), code: order.code, status: 'rejected', rejectionReason: reason },
      }),
    );
    safely('Erro ao notificar admins', () =>
      notifyAdmins({ type: 'recharge:resolved', order: { id: String(order._id), status: 'rejected' } }),
    );

    const populated = await RechargeOrder.findById(order._id).populate('store', 'name email phone');
    return res.status(200).json(serializeAdminOrder(populated));
  } catch (error) {
    console.error('Erro no rejectRechargeOrder:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// ---------------------------------------------------------------- Saldo por loja

// GET /admin/stores/:id/credits — saldo e últimas movimentações da loja.
export const getStoreCredits = async (req, res) => {
  try {
    const { id } = req.params;
    const store = await Store.findById(id).select('name freeDeliveriesRemaining deliveryCredits');
    if (!store) return res.status(404).json({ error: 'Loja não encontrada.' });

    const transactions = await CreditTransaction.find({ store: id })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('type delta balanceAfter note createdAt');

    return res.status(200).json({
      free: store.freeDeliveriesRemaining ?? 0,
      purchased: store.deliveryCredits ?? 0,
      available: (store.freeDeliveriesRemaining ?? 0) + (store.deliveryCredits ?? 0),
      transactions,
    });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ error: 'Loja não encontrada.' });
    console.error('Erro no getStoreCredits:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// POST /admin/stores/:id/credits  { delta, note }
// Ajuste manual (cortesia, correção). Positivo soma, negativo tira; o saldo
// nunca fica abaixo de zero. Fica registrado no extrato com o motivo.
export const adjustStoreCredits = async (req, res) => {
  try {
    const { id } = req.params;
    const { delta, note } = matchedData(req, { locations: ['body'] });

    const exists = await Store.exists({ _id: id });
    if (!exists) return res.status(404).json({ error: 'Loja não encontrada.' });

    let result;
    if (delta > 0) {
      result = await grantCredits({ storeId: id, amount: delta, type: 'adjustment', admin: req.user.id, note });
    } else {
      result = await adjustCredits({ storeId: id, delta, admin: req.user.id, note });
    }

    if (!result) {
      return res.status(409).json({ error: 'O ajuste deixaria o saldo negativo.' });
    }

    const store = await Store.findById(id).select('freeDeliveriesRemaining deliveryCredits');
    const credits = {
      free: store.freeDeliveriesRemaining ?? 0,
      purchased: store.deliveryCredits ?? 0,
      available: (store.freeDeliveriesRemaining ?? 0) + (store.deliveryCredits ?? 0),
    };

    safely('Erro ao notificar loja', () =>
      notifyStore(id, { type: 'credits:updated', reason: 'adjustment', credits }),
    );

    return res.status(200).json(credits);
  } catch (error) {
    console.error('Erro no adjustStoreCredits:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};
