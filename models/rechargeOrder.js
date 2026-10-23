import mongoose from 'mongoose';

// Pedido de recarga: a loja escolhe um pacote, o sistema gera o Pix, a loja
// paga e clica em "Já paguei", e o admin confere o dinheiro e confirma.
//
// status:
//  pending   aguardando pagamento (Pix gerado)
//  informed  a loja disse que pagou — aguardando conferência do admin
//  confirmed admin confirmou — as entregas já foram creditadas na loja
//  rejected  admin recusou (não encontrou o pagamento etc.) — tem motivo
//  cancelled a loja desistiu antes de pagar
//
// Os créditos SÓ entram na loja quando o admin confirma. O botão
// "Já paguei" apenas avisa o admin, nunca libera saldo.
const rechargeOrderSchema = new mongoose.Schema({
  // Código curto e legível (ex.: R7K3F9Q) que a loja e o admin usam para
  // se referir ao pedido. Também vai como identificador (txid) no Pix.
  code: {
    type: String,
    required: true,
    unique: true,
  },
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
  },
  // Cópia do pacote no momento da compra (não muda se o pacote for editado
  // ou excluído depois).
  package: {
    packageId: { type: mongoose.Schema.Types.ObjectId, default: null },
    name: { type: String, required: true },
    deliveries: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0.01 },
  },
  status: {
    type: String,
    enum: ['pending', 'informed', 'confirmed', 'rejected', 'cancelled'],
    default: 'pending',
  },
  // true enquanto o pedido está pending/informed. Existe para o índice
  // abaixo garantir, no banco, no máximo UM pedido em aberto por loja.
  open: {
    type: Boolean,
    default: true,
  },
  // "Pix copia e cola" gerado na criação (o QR code é desenhado a partir dele).
  pixPayload: {
    type: String,
    required: true,
  },
  informedAt: { type: Date, default: null },
  payerNote: { type: String, default: null, maxlength: 200 },
  receiptUrl: { type: String, default: null },
  confirmedAt: { type: Date, default: null },
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  rejectedAt: { type: Date, default: null },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  rejectionReason: { type: String, default: null, maxlength: 200 },
  cancelledAt: { type: Date, default: null },
}, { timestamps: true });

// Um único pedido aberto por loja. Sem `index: true` no campo `store`: ele geraria
// um índice comum com o mesmo nome (store_1) e este índice único não seria criado.
rechargeOrderSchema.index({ store: 1 }, { unique: true, partialFilterExpression: { open: true }, name: 'store_open_unique' });
rechargeOrderSchema.index({ status: 1, createdAt: -1 });

const RechargeOrder = mongoose.models.RechargeOrder || mongoose.model('RechargeOrder', rechargeOrderSchema);
export default RechargeOrder;
