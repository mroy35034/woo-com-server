"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var conn = require("../utils/db");
var mongodb = require("mongodb");
module.exports.CountAllProductsBySeller = (seller) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let db = yield conn.dbConnection();
        return yield db.collection('products').countDocuments({ 'seller.name': seller });
    }
    catch (error) {
        return error.message;
    }
});
module.exports.CountAllProducts = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let db = yield conn.dbConnection();
        return yield db.collection('products').countDocuments({ $and: [{ status: 'active' }, { save_as: 'fulfilled' }] });
    }
    catch (error) {
        return error.message;
    }
});
module.exports = function productCounterAndSetter(user) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let db = yield conn.dbConnection();
            let tp = yield db.collection('products').countDocuments({ $and: [{ 'seller.name': user.username }, { 'seller.uuid': mongodb.ObjectId(user._id) }] });
            return yield db.collection('users').updateOne({ $and: [{ email: user.email }, { role: 'seller' }] }, { $set: { 'inventoryInfo.totalProducts': tp } }, { upsert: true });
        }
        catch (error) {
            return error.message;
        }
    });
};
