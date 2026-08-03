import mongoose from 'mongoose';

const riderSchema = new mongoose.Schema({
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
  rating: {
    type: Number,
    required: false,
    default: 5
  },
  votes: {
    type: Number,
    required: false,
    default: 0
  },
  totalRating: {
    type: Number,
    required: false,
    default: 0
  },
  online: {
    type: Boolean,
    required: false,
    default: false
  },
  position: {
    latitude: Number,
    longitude: Number
  },
  vehicle: {
    type: {
      type: String,
      enum: ['Carro', 'Moto', 'Bicicleta'],
      required: true
    },
    model: {
      type: String,
      required: false,
      default: null
    },
    color: {
      type: String,
      required: false,
      default: null
    },
    plate: {
      type: String,
      required: false,
      default: null   // bicicleta normalmente não tem placa
    }
  },
  pix: {
    favorecido: String,
    chave: String
  },
  pushToken: {
    type: String,
    required: false,
    default: null
  },
  accountApprovedAt: {
    type: Date,
    required: false,
    default: null
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
  }
  //resetPasswordCodeExpiresAt
}, { timestamps: true });

const Rider = mongoose.model('Rider', riderSchema);
export default Rider;