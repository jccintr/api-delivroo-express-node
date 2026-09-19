import mongoose from 'mongoose';

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  doc: {
    type: String,
    required: false,
    default: null
  },
  avatar: {
    type: String,
    required: false,
    default: null
  },
  city: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'City',
    required: true
  },
  address:{
      street: String,
      number: String,
      complement: String,
      district: String,
      //city: String,
      //state: String,
      zipCode: String,
      latitude: Number,
      longitude: Number
  },
   pushToken: {
    type: String,
    required: false,
    default: null
  },
  // Saldo de entregas grátis restantes (isentas da taxa da plataforma).
  // Concedido no cadastro (ver register() em store.controller.js), com base
  // no que estava vigente em Settings naquele momento — mudanças
  // posteriores na promoção não afetam o saldo já concedido a esta loja.
  // Decrementado em deliverDelivery() (delivery.controller.js) sempre que
  // uma entrega é concluída com saldo disponível.
  freeDeliveriesRemaining: {
    type: Number,
    required: false,
    default: 0,
    min: 0,
  },
  active: {
    type: Boolean,
    required: false,
    default: true
  },
  emailVerifiedAt:{
      type:Date,
      required:false,
      default:null
  },
  emailVerificationCode:{
      type:String,
      required:false,
      default: null
  },
  resetPasswordCode: {
    type: String,
    required: false,
    default: null
  },
   resetPasswordCodeExpiresAt:{
      type:Date,
      required:false,
      default:null
  },
}, { timestamps: true });

const Store = mongoose.model('Store', storeSchema);
export default Store;