import mongoose from 'mongoose';

// status da entrega:
//  0: solicitada pela loja (disponível para qualquer rider elegível)
//  1: aceita pelo entregador
//  2: pacote retirado pelo entregador
//  3: entregador a caminho do destino
//  4: pacote entregue
//  5: pacote devolvido à loja        (cancelReason)
//  6: entrega cancelada pela loja     (cancelReason)
//  7: entrega cancelada pelo entregador ANTES da retirada — nesse caso a
//     entrega não fica presa em 7: ela volta para status 0 com rider: null,
//     para reentrar no pool de disponíveis. O valor 7 nunca é persistido —
//     existe aqui só como documentação da transição (ver cancelDeliveryByRider).
const deliverySchema = new mongoose.Schema({

 data:{
        type:Date,
        default:Date.now
 },
 store:{
        type: mongoose.Types.ObjectId,
        ref: "Store",
        required:true
 },
 rider:{
        type: mongoose.Types.ObjectId,
        ref: "Rider",
        default:null
 },
 origem:{latitude:Number,longitude:Number,address:String},  
 destino:{latitude:Number,longitude:Number,address:String,nome:String,telefone:String},
 distancia: { 
    type:Number,
    required:true
 },
 status:{
        type:Number,
        enum: [0, 1, 2, 3, 4, 5, 6],
        default:0
 },
 // Preenchido nas transições para status 5 (devolvida) e 6 (cancelada pela
 // loja) — motivo em texto, para permitir relatórios/filtros depois sem
 // precisar reprocessar o array `events`.
 cancelReason: {
        type: String,
        default: null,
 },
 acceptedAt:   { type: Date, default: null },
 pickedUpAt:   { type: Date, default: null },
 dispatchedAt: { type: Date, default: null },
 deliveredAt:  { type: Date, default: null },
 riderRating:{
        type:Number,
        required:false,
        default: null
 },
 events:[
  {
    data:{ type:Date,},
    descricao:{type:String,}       
  },
 ],
 package: {
  description:   { type: String, required: true },  
  category :     { type: String, enum: ['Comida', 'Documentos', 'Pacote', 'Medicamentos', 'Peças','Outros'],default: 'Comida'},
  quantity:      { type: Number, required: true, min: 1, default: 1 },
  weight:        { type: Number, required: false, default: null },   // kg
  declaredvalue: { type: Number, default: 0 },
  notes:         { type: String, required: false },
  payment:       { type: String, enum: ['Dinheiro','Cartão Crédito','Cartão Débito','Pago','Nada a Pagar'], default: 'Dinheiro'},
  cashChange:    { type: Number, default: 0 },
  amountDue:     { type: Number, default: 0, min: 0 }, 
},
riderPayout: {
  type: Number,
  required: true,
  min: 0,
},

}, { timestamps: true });

const Delivery = mongoose.model('Delivery', deliverySchema);
export default Delivery;