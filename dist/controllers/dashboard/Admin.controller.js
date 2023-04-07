"use strict";
// Admin.controller.tsx
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const QueueProduct = require("../../model/queueProduct.model");
const Product = require("../../model/product.model");
const User = require("../../model/user.model");
const email_service = require("../../services/email.service");
const apiResponse = require("../../errors/apiResponse");
const { ObjectId } = require('mongodb');
// Controllers...
module.exports.getAdminController = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const pages = req.query.pages;
        const item = req.query.items;
        let queueProducts;
        let countQueueProducts = yield QueueProduct.countDocuments({ isVerified: false, save_as: "queue" });
        if (pages || item) {
            queueProducts = yield QueueProduct.find({ isVerified: false }).skip(parseInt(pages) > 0 ? ((pages - 1) * item) : 0).limit(item);
        }
        else {
            queueProducts = yield QueueProduct.find({ isVerified: false });
        }
        return res.status(200).send({ success: true, statusCode: 200, data: { queueProducts, countQueueProducts } });
    }
    catch (error) {
        next(error);
    }
});
module.exports.takeThisProductByAdminController = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const listingID = req.headers.authorization || "";
        const adminEmail = req.decoded.email;
        const role = req.decoded.role;
        if (!listingID) {
            throw new Error("Listing ID required !");
        }
        var queueProduct = yield QueueProduct.findOne({ _lid: listingID }, { __v: 0 });
        if (!queueProduct) {
            throw new Error("Sorry product not found !");
        }
        queueProduct.isVerified = true;
        queueProduct.save_as = "draft";
        queueProduct["verifyStatus"] = { verifiedBy: role, email: adminEmail, verifiedAt: new Date(Date.now()) };
        let filter = { $and: [{ _id: ObjectId(queueProduct === null || queueProduct === void 0 ? void 0 : queueProduct._id) }, { _lid: queueProduct === null || queueProduct === void 0 ? void 0 : queueProduct._lid }] };
        const result = yield Product.updateOne(filter, { $set: queueProduct }, { upsert: true });
        if ((result === null || result === void 0 ? void 0 : result.upsertedCount) === 1) {
            yield QueueProduct.deleteOne(filter);
            return res.status(200).send({ success: true, statusCode: 200, message: "Product taken." });
        }
        else {
            return res.status(200).send({ success: false, statusCode: 200, message: "Product not taken !" });
        }
    }
    catch (error) {
        next(error);
    }
});
module.exports.verifySellerAccountByAdmin = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { uuid, id } = req.body;
        if (!uuid || typeof uuid === "undefined")
            throw new apiResponse.Api400Error("Required user unique id !");
        if (!id || typeof id === "undefined")
            throw new apiResponse.Api400Error("Required id !");
        const result = yield User.findOneAndUpdate({ $and: [{ _id: ObjectId(id) }, { _uuid: uuid }] }, {
            $set: {
                accountStatus: "active",
                isSeller: "fulfilled"
            }
        }, {
            upsert: true
        });
        if (result) {
            yield email_service({
                to: result === null || result === void 0 ? void 0 : result.email,
                subject: "Verify email address",
                html: `
               <h5>Thanks for with us</h5>
               <p style="color: 'green'">We have verified your account. Now you can login</p>
            `
            });
            return res.status(200).send({ success: true, statusCode: 200, message: "Permission granted." });
        }
        throw new apiResponse.Api400Error("Internal problem !");
    }
    catch (error) {
        next(error);
    }
});
