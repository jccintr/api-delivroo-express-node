import mongoose from 'mongoose';

// Extrato do saldo de entregas COMPRADAS (deliveryCredits da loja). Toda
// entrada e saída fica registrada aqui, para o admin conseguir explicar
// qualquer saldo e a loja ver o histórico.
//
// type:
//  purchase    entrada: recarga confirmada pelo admin (delta > 0)
//  delivery    saída: uma entrega concluída consumiu 1 crédito (delta = -1)
//  adjustment  entrada ou saída manual feita pelo admin (cortesia, correção)
//
// Não inclui as entregas grátis da promoção (freeDeliveriesRemaining), que
// têm contador próprio na loja.
const creditTransactionSchema = new mongoose.Schema({
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
  },
  type: {
    type: String,
    enum: ['purchase', 'delivery', 'adjustment'],
    required: true,
  },
  // Variação do saldo: positivo entra, negativo sai.
  delta: {
    type: Number,
    required: true,
  },
  // Saldo de créditos comprados logo depois desta movimentação.
  balanceAfter: {
    type: Number,
    required: true,
    min: 0,
  },
  recharge: { type: mongoose.Schema.Types.ObjectId, ref: 'RechargeOrder', default: null },
  delivery: { type: mongoose.Schema.Types.ObjectId, ref: 'Delivery', default: null },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  note: { type: String, default: null, maxlength: 200 },
}, { timestamps: { createdAt: true, updatedAt: false } });

creditTransactionSchema.index({ store: 1, createdAt: -1 });
// Cada recarga confirmada credita uma única vez, e cada entrega consome
// crédito uma única vez — mesmo que a requisição seja repetida.
creditTransactionSchema.index({ recharge: 1 }, { unique: true, partialFilterExpression: { type: 'purchase' } });
creditTransactionSchema.index({ delivery: 1 }, { unique: true, partialFilterExpression: { type: 'delivery' } });

const CreditTransaction = mongoose.models.CreditTransaction || mongoose.model('CreditTransaction', creditTransactionSchema);
export default CreditTransaction;
