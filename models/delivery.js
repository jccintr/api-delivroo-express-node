import mongoose from 'mongoose';

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
        default:0
 },
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
  weight:        { type: Number, required: false },   // kg
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