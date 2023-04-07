// Admin.controller.tsx

import { NextFunction, Request, Response } from "express";
const QueueProduct = require("../../model/queueProduct.model");
const Product = require("../../model/product.model");
const User = require("../../model/user.model");
const email_service = require("../../services/email.service");
const apiResponse = require("../../errors/apiResponse");

const { ObjectId } = require('mongodb');


// Controllers...
module.exports.getAdminController = async (req: Request, res: Response, next: NextFunction) => {
   try {

      const pages: any = req.query.pages;
      const item: any = req.query.items;
      let queueProducts: any;

      let countQueueProducts = await QueueProduct.countDocuments({ isVerified: false, save_as: "queue" });

      let sellers = await User.find({ $and: [{ isSeller: 'pending' }, { role: "SELLER" }] });

      if (pages || item) {
         queueProducts = await QueueProduct.find({ isVerified: false }).skip(parseInt(pages) > 0 ? ((pages - 1) * item) : 0).limit(item);
      } else {
         queueProducts = await QueueProduct.find({ isVerified: false });
      }


      return res.status(200).send({ success: true, statusCode: 200, data: { queueProducts, countQueueProducts, sellers } });
   } catch (error: any) {
      next(error);
   }
}



module.exports.takeThisProductByAdminController = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const listingID: string = req.headers.authorization || "";
      const adminEmail: string = req.decoded.email;
      const role: string = req.decoded.role;

      if (!listingID) {
         throw new Error("Listing ID required !");
      }

      var queueProduct = await QueueProduct.findOne({ _lid: listingID }, { __v: 0 });

      if (!queueProduct) {
         throw new Error("Sorry product not found !");
      }

      queueProduct.isVerified = true;
      queueProduct.save_as = "draft";
      queueProduct["verifyStatus"] = { verifiedBy: role, email: adminEmail, verifiedAt: new Date(Date.now()) };

      let filter = { $and: [{ _id: ObjectId(queueProduct?._id) }, { _lid: queueProduct?._lid }] };

      const result = await Product.updateOne(
         filter,
         { $set: queueProduct },
         { upsert: true }
      );

      if (result?.upsertedCount === 1) {

         await QueueProduct.deleteOne(filter);

         return res.status(200).send({ success: true, statusCode: 200, message: "Product taken." });
      } else {
         return res.status(200).send({ success: false, statusCode: 200, message: "Product not taken !" });
      }

   } catch (error: any) {
      next(error);
   }
}



module.exports.verifySellerAccountByAdmin = async (req: Request, res: Response, next: NextFunction) => {
   try {

      const { uuid, id, email } = req.body;

      if (!uuid || typeof uuid === "undefined") throw new apiResponse.Api400Error("Required user unique id !");

      if (!id || typeof id === "undefined") throw new apiResponse.Api400Error("Required id !");

      const result = await User.findOneAndUpdate(
         { $and: [{ _id: ObjectId(id) }, { email }, { _uuid: uuid }, { isSeller: "pending" }] },
         {
            $set: {
               accountStatus: "active",
               isSeller: "fulfilled",
               becomeSellerAt: new Date()
            }
         },
         {
            upsert: true
         }
      );

      if (result) {
         await email_service({
            to: result?.email,
            subject: "Verify email address",
            html: `
               <h5>Thanks for with us !</h5>
               <p style="color: 'green'">We have verified your seller account. Now you can login your seller id.</p>
            `
         })
         return res.status(200).send({ success: true, statusCode: 200, message: "Permission granted." });
      }

      throw new apiResponse.Api400Error("Internal problem !");

   } catch (error: any) {
      next(error);
   }
}