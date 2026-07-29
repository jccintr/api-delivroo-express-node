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
 destino:{latitude:Number,longitude:Number,address:String},
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
       items: number,
       weight: number
  }

}, { timestamps: true });

const Delivery = mongoose.model('Delivery', storeSchema);
export default Delivery;