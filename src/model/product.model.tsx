import { Schema, model } from "mongoose";

var ProductSchema = new Schema({
   _lid: { type: String, required: true },

   title: { type: String, required: true },

   slug: { type: String, required: true },

   categories: { type: Array, required: true },

   brand: { type: String, required: true },

   manufacturer: {
      origin: { type: String, required: true },
      details: { type: String, required: true }
   },

   packaged: { type: Object, required: true },

   shipping: {
      fulfilledBy: { type: String, required: true },
      procurementType: { type: String, required: true },
      procurementSLA: { type: String, required: true },
      provider: { type: String, required: true },
      isFree: { type: Boolean }
   },

   rating: { type: Array, required: true },

   reviews: { type: Array, required: true },

   ratingAverage: { type: Number, required: true, default: 0 },

   keywords: { type: Array, required: true },

   meta_description: { type: String, required: true },

   highlights: { type: Array, required: false },

   specification: { type: Object, required: true },

   description: { type: String, required: true },
   
   options: [
      {
         _id: false,
         color: String,
         images: Array
      }
   ],

   variations: { type: Array, required: true },

   tax: {
      hsn: { type: String, required: true },
      code: { type: String, required: true }
   },

   supplier: {
      id: { type: String, required: true },
      email: { type: String, required: true },
      store_name: { type: String, required: true }
   },

   warranty: {
      type: { type: String, required: false },
      duration: { type: Number, required: false },
      details: { type: String, required: false }
   },

   save_as: { type: String, required: true, enum: ["fulfilled", "draft"] },

   status: { type: String, required: true, enum: ["active", "inactive"], default: "inactive" },

   views: { type: Number },

   score: { type: Number },

   sales: { type: Number },

   createdAt: { type: Date, required: true },

   modifiedAt: { type: Date, required: false },

   isVerified: { type: Boolean, required: true },

   verifyStatus: {
      verifiedBy: { type: String, required: true },
      email: { type: String, required: true },
      verifiedAt: { type: Date, required: true }
   }
});

const Product = model('Product', ProductSchema, 'products');

module.exports = Product;
