import mongoose from 'mongoose';

// Pacote de entregas pré-pagas que as lojas compram via Pix. Criado e
// gerenciado pelo admin (criar, editar, desabilitar, excluir).
//
// Excluir um pacote é seguro: cada pedido de recarga guarda uma cópia do
// nome, da quantidade e do preço no momento da compra (ver RechargeOrder),
// então apagar o pacote não altera pedidos antigos.
const creditPackageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 60,
  },
  // Quantidade de entregas que o pacote libera.
  deliveries: {
    type: Number,
    required: true,
    min: 1,
    max: 100000,
    validate: { validator: Number.isInteger, message: 'deliveries deve ser inteiro' },
  },
  // Preço do pacote em reais (2 casas decimais).
  price: {
    type: Number,
    required: true,
    min: 0.01,
    max: 100000,
  },
  // Pacote desabilitado não aparece para as lojas, mas continua no admin.
  active: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

const CreditPackage = mongoose.models.CreditPackage || mongoose.model('CreditPackage', creditPackageSchema);
export default CreditPackage;
