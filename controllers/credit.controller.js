import crypto from 'crypto';
import QRCode from 'qrcode';
import { matchedData } from 'express-validator';
import Store from '../models/store.js';
import CreditPackage from '../models/creditPackage.js';
import RechargeOrder from '../models/rechargeOrder.js';
import CreditTransaction from '../models/creditTransaction.js';
import { getOrCreateSettings } from '../models/settings.js';
import cloudinary from '../utils/cloudinary.js';
import { buildPixPayload, getPixConfig, PixNotConfiguredError } from '../utils/pix.js';
import { getStoreBalance, isDuplicateKeyError } from '../utils/credits.js';
import { sendAdminRechargeInformedEmail } from '../utils/sendEmailV2.js';
import { notifyAdmins } from '../websocket.js';

// Rotas da LOJA para comprar pacotes de entregas pré-pagos via Pix.
// Fluxo: escolher pacote → pedido (pending) com QR Pix → "Já paguei"
// (informed) → admin confirma (confirmed) e o saldo é creditado.

// Sem 0/O/1/I/L: o código é lido e digitado por pessoas.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateOrderCode() {
  let code = 'R';
  for (let i = 0; i < 6; i += 1) {
    code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

const roundMoney = (value) => Math.round(Number(value) * 100) / 100;

// Forma pública do pedido. O QR code (imagem PNG em data URL) é desenhado na
// hora a partir do "copia e cola", só enquanto o pedido ainda aguarda pagamento.
export async function serializeOrder(order, { withQr = false } = {}) {
  const plain = typeof order.toObject === 'function' ? order.toObject() : order;
  const awaitingPayment = plain.status === 'pending' || plain.status === 'informed';

  const result = {
    id: String(plain._id),
    code: plain.code,
    status: plain.status,
    package: plain.package,
    pixPayload: awaitingPayment ? plain.pixPayload : null,
    informedAt: plain.informedAt,
    payerNote: plain.payerNote,
    receiptUrl: plain.receiptUrl,
    confirmedAt: plain.confirmedAt,
    rejectedAt: plain.rejectedAt,
    rejectionReason: plain.rejectionReason,
    cancelledAt: plain.cancelledAt,
    createdAt: plain.createdAt,
  };

  if (withQr && awaitingPayment) {
    result.qrCodeDataUrl = await QRCode.toDataURL(plain.pixPayload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
    });
  }

  return result;
}

const respondOpenOrderExists = async (res, storeId) => {
  const existing = await RechargeOrder.findOne({ store: storeId, open: true });
  return res.status(409).json({
    error: 'Você já tem um pedido de recarga em aberto. Conclua ou cancele esse pedido antes de criar outro.',
    code: 'OPEN_ORDER_EXISTS',
    order: existing ? await serializeOrder(existing, { withQr: true }) : null,
  });
};

// GET /stores/credits/packages
// Pacotes disponíveis para compra (só os habilitados), do menor para o maior.
export const listPackages = async (req, res) => {
  try {
    const [packages, settings] = await Promise.all([
      CreditPackage.find({ active: true }).sort({ deliveries: 1, price: 1 }),
      getOrCreateSettings(),
    ]);

    return res.status(200).json({
      deliveryFee: settings.deliveryFee,
      packages: packages.map((p) => ({
        id: String(p._id),
        name: p.name,
        deliveries: p.deliveries,
        price: p.price,
        unitPrice: roundMoney(p.price / p.deliveries),
      })),
    });
  } catch (error) {
    console.error('Erro no listPackages:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// GET /stores/credits
// Saldo da loja e o pedido em aberto (se houver), para a tela de créditos.
export const getCredits = async (req, res) => {
  try {
    const storeId = req.user?.id;
    const balance = await getStoreBalance(storeId);
    if (!balance) {
      return res.status(404).json({ error: 'Loja não encontrada.' });
    }

    const openOrder = await RechargeOrder.findOne({ store: storeId, open: true });

    return res.status(200).json({
      ...balance,
      openOrder: openOrder ? await serializeOrder(openOrder, { withQr: true }) : null,
    });
  } catch (error) {
    console.error('Erro no getCredits:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// GET /stores/credits/transactions
// Extrato do saldo comprado (entradas e saídas), mais recente primeiro.
export const listTransactions = async (req, res) => {
  try {
    const storeId = req.user?.id;
    const { page = 1, limit = 20 } = matchedData(req, { locations: ['query'] });

    const filter = { store: storeId };
    const [data, total] = await Promise.all([
      CreditTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('type delta balanceAfter note createdAt'),
      CreditTransaction.countDocuments(filter),
    ]);

    return res.status(200).json({
      data,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error('Erro no listTransactions:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// POST /stores/credits/orders  { packageId }
// Cria o pedido de recarga e devolve o Pix (QR + copia e cola). Só pode
// haver um pedido em aberto por loja.
export const createRechargeOrder = async (req, res) => {
  try {
    const storeId = req.user?.id;
    const { packageId } = matchedData(req, { locations: ['body'] });

    const store = await Store.findById(storeId).select('active emailVerifiedAt');
    if (!store) return res.status(404).json({ error: 'Loja não encontrada.' });
    if (!store.active) return res.status(403).json({ error: 'Conta desativada.' });
    if (!store.emailVerifiedAt) return res.status(403).json({ error: 'Conta ainda não verificada.' });

    const pkg = await CreditPackage.findOne({ _id: packageId, active: true });
    if (!pkg) {
      return res.status(404).json({ error: 'Pacote não encontrado ou indisponível.' });
    }

    let pix;
    try {
      pix = getPixConfig();
    } catch (error) {
      if (error instanceof PixNotConfiguredError) {
        console.error(error.message);
        return res.status(503).json({
          error: 'Pagamento indisponível no momento. Tente novamente mais tarde.',
          code: 'PIX_NOT_CONFIGURED',
        });
      }
      throw error;
    }

    if (await RechargeOrder.exists({ store: storeId, open: true })) {
      return respondOpenOrderExists(res, storeId);
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generateOrderCode();
      try {
        const order = await RechargeOrder.create({
          code,
          store: storeId,
          package: {
            packageId: pkg._id,
            name: pkg.name,
            deliveries: pkg.deliveries,
            price: pkg.price,
          },
          pixPayload: buildPixPayload({
            ...pix,
            amount: pkg.price,
            txid: code,
          }),
        });

        return res.status(201).json(await serializeOrder(order, { withQr: true }));
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        // Índice da loja (já existe pedido aberto) x índice do código (repetido).
        if (error.keyPattern?.store) {
          return respondOpenOrderExists(res, storeId);
        }
        // Código repetido: sorteia outro e tenta de novo.
      }
    }

    return res.status(500).json({ error: 'Não foi possível gerar o pedido. Tente novamente.' });
  } catch (error) {
    console.error('Erro no createRechargeOrder:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// GET /stores/credits/orders
// Histórico de pedidos de recarga da loja.
export const listRechargeOrders = async (req, res) => {
  try {
    const storeId = req.user?.id;
    const { page = 1, limit = 20 } = matchedData(req, { locations: ['query'] });

    const filter = { store: storeId };
    const [orders, total] = await Promise.all([
      RechargeOrder.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      RechargeOrder.countDocuments(filter),
    ]);

    return res.status(200).json({
      data: await Promise.all(orders.map((o) => serializeOrder(o))),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error('Erro no listRechargeOrders:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// GET /stores/credits/orders/:id
export const getRechargeOrder = async (req, res) => {
  try {
    const storeId = req.user?.id;
    const order = await RechargeOrder.findOne({ _id: req.params.id, store: storeId });
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });

    return res.status(200).json(await serializeOrder(order, { withQr: true }));
  } catch (error) {
    console.error('Erro no getRechargeOrder:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

function uploadReceipt(file, code) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'delivroo/recharge-receipts',
        public_id: `recharge_${code}`,
        overwrite: true,
        resource_type: 'auto',
      },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
    stream.end(file.buffer);
  });
}

// POST /stores/credits/orders/:id/inform   (multipart: payerNote?, receipt?)
// "Já paguei": marca o pedido como informado e avisa o admin por e-mail e
// em tempo real. NÃO libera saldo — só o admin confirma. O comprovante é
// opcional. Só vale para pedidos ainda aguardando pagamento (pending).
export const informPayment = async (req, res) => {
  try {
    const storeId = req.user?.id;
    const { id } = req.params;
    const payerNote = typeof req.body?.payerNote === 'string' ? req.body.payerNote.trim() : '';

    if (payerNote.length > 200) {
      return res.status(400).json({ error: 'Observação deve ter no máximo 200 caracteres' });
    }

    const current = await RechargeOrder.findOne({ _id: id, store: storeId });
    if (!current) return res.status(404).json({ error: 'Pedido não encontrado.' });

    if (current.status !== 'pending') {
      const messages = {
        informed: 'Você já informou este pagamento. Aguarde a confirmação.',
        confirmed: 'Este pedido já foi confirmado.',
        rejected: 'Este pedido foi recusado. Gere um novo pedido de recarga.',
        cancelled: 'Este pedido foi cancelado. Gere um novo pedido de recarga.',
      };
      return res.status(409).json({ error: messages[current.status] ?? 'Pedido não pode ser alterado.' });
    }

    let receiptUrl = null;
    if (req.file) {
      try {
        const uploaded = await uploadReceipt(req.file, current.code);
        receiptUrl = uploaded.secure_url;
      } catch (error) {
        console.error('Erro ao enviar comprovante:', error);
        return res.status(502).json({
          error: 'Não foi possível enviar o comprovante. Tente novamente ou informe o pagamento sem ele.',
        });
      }
    }

    // A troca pending → informed é atômica: dois cliques seguidos avisam o
    // admin uma vez só.
    const order = await RechargeOrder.findOneAndUpdate(
      { _id: id, store: storeId, status: 'pending' },
      {
        status: 'informed',
        informedAt: new Date(),
        payerNote: payerNote || null,
        receiptUrl,
      },
      { returnDocument: 'after' },
    );

    if (!order) {
      return res.status(409).json({ error: 'Você já informou este pagamento. Aguarde a confirmação.' });
    }

    const store = await Store.findById(storeId).select('name email phone');

    // Avisos ao admin: falha de e-mail ou de WebSocket nunca desfaz o
    // "Já paguei" — o pedido continua visível na fila do painel.
    Promise.allSettled([
      sendAdminRechargeInformedEmail({ order, store }),
    ]).then(([emailResult]) => {
      if (emailResult.status === 'rejected') {
        console.error('Erro ao enviar e-mail de pagamento informado:', emailResult.reason);
      }
    });

    try {
      notifyAdmins({
        type: 'recharge:informed',
        order: {
          id: String(order._id),
          code: order.code,
          package: order.package,
          informedAt: order.informedAt,
          store: { id: String(storeId), name: store?.name },
        },
      });
    } catch (error) {
      console.error('Erro ao notificar admins:', error);
    }

    return res.status(200).json(await serializeOrder(order, { withQr: true }));
  } catch (error) {
    console.error('Erro no informPayment:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// POST /stores/credits/orders/:id/cancel
// A loja desiste de um pedido que ainda não pagou (status pending).
export const cancelRechargeOrder = async (req, res) => {
  try {
    const storeId = req.user?.id;
    const { id } = req.params;

    const order = await RechargeOrder.findOneAndUpdate(
      { _id: id, store: storeId, status: 'pending' },
      { status: 'cancelled', open: false, cancelledAt: new Date() },
      { returnDocument: 'after' },
    );

    if (!order) {
      const exists = await RechargeOrder.exists({ _id: id, store: storeId });
      if (!exists) return res.status(404).json({ error: 'Pedido não encontrado.' });
      return res.status(409).json({
        error: 'Só é possível cancelar um pedido que ainda não foi pago. Se você já pagou, aguarde a confirmação.',
      });
    }

    return res.status(200).json(await serializeOrder(order));
  } catch (error) {
    console.error('Erro no cancelRechargeOrder:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};
