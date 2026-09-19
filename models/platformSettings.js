import mongoose from 'mongoose';
// só para commit

// Documento único (singleton) com as configurações globais de faturamento
// da plataforma. Não existe rota de criação: getOrCreatePlatformSettings()
// cria o documento com os valores padrão abaixo na primeira vez que alguém
// precisar dele (registro de loja, conclusão de entrega, painel do admin).
const platformSettingsSchema = new mongoose.Schema({
  // Taxa (em R$) cobrada da loja por entrega concluída, quando ela não tem
  // mais saldo de entregas grátis. Lida em tempo real a cada entrega
  // concluída — mudar este valor não afeta entregas já finalizadas
  // (o valor cobrado fica gravado em delivery.platformFee), só as próximas.
  deliveryFee: {
    type: Number,
    required: true,
    default: 1.5,
    min: 0,
  },
  // Controla se lojas cadastradas a partir de agora recebem o saldo de
  // entregas grátis. Desativar isto NÃO afeta o saldo já concedido a lojas
  // existentes — só passa a zerar o saldo inicial de quem se cadastrar
  // depois (ver register() em store.controller.js).
  freeDeliveriesPromoActive: {
    type: Boolean,
    required: true,
    default: true,
  },
  // Quantidade de entregas grátis concedidas a cada loja nova, enquanto a
  // promoção acima estiver ativa.
  freeDeliveriesGranted: {
    type: Number,
    required: true,
    default: 5,
    min: 0,
  },
}, { timestamps: true });

const PlatformSettings = mongoose.model('PlatformSettings', platformSettingsSchema);

// Helper central: todo mundo que precisa das configurações vigentes (registro
// de loja, cálculo da taxa na entrega, painel do admin) deve passar por aqui
// em vez de fazer PlatformSettings.findOne() direto, para garantir que o
// singleton sempre exista (evita checagem de "documento não encontrado"
// espalhada pelo resto do código).
export async function getOrCreatePlatformSettings() {
  let settings = await PlatformSettings.findOne();
  if (!settings) {
    settings = await PlatformSettings.create({});
  }
  return settings;
}

export default PlatformSettings;