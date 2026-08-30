import mongoose from 'mongoose';

const citySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    maxlength: 2
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  active: {
    type: Boolean,
    required: false,
    default: true
  },

  // Campos opcionais
  center: {
    latitude: {
      type: Number,
      required: false,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      required: false,
      min: -180,
      max: 180
    }
  },
  radiusKm: {
    type: Number,
    required: false,
    min: 1,
    max: 100
  }
}, {
  timestamps: true
});



const City = mongoose.model('City', citySchema);
export default City;