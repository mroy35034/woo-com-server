const mongoDB = require("mongodb");
const { basicProductProject } = require("./projection");

const productTypeSingle = {
   title: "$title",
   image: { $arrayElemAt: ["$images", 0] },
   stockPrice: "$stockPrice",
   sellPrice: "$sellPrice",
   discount: "$discount",
   attributes: "$attributes",
   stockQuantity: "$stockQuantity",
   stock: "$stock",
   sku: "$sku"
}

const variationTables = {
   $lookup: {
      from: 'PRODUCT_VARIATION_TBL',
      localField: "_id",
      foreignField: "productId",
      as: "variations"
   }
}

const variationTable = {
   $lookup: {
      from: 'PRODUCT_VARIATION_TBL',
      localField: "_id",
      foreignField: "productId",
      as: "variation"
   }
}


const basicProductQuery: any[] = [
   {
      $lookup: {
         from: "PRODUCT_VARIATION_TBL",
         let: { mainProductId: "$_id" },
         pipeline: [
            {
               $match:
               {
                  $expr:
                  {
                     $and: [
                        { $eq: ["$productId", "$$mainProductId"] },
                        { $eq: ["$stock", "in"] }
                     ]
                  }
               }
            },
            { $project: { productId: 0, _id: 0 } }
         ],
         as: "variations"
      }
   },
   {
      $replaceRoot: {
         newRoot: {
            $mergeObjects: [{
               $arrayElemAt: [
                  {
                     $ifNull: [{
                        $filter: {
                           input: "$variations",
                           as: "variation",
                           cond: { $eq: ["$$variation.stock", "in"] }
                        }
                     }, []]
                  },
                  0
               ]
            }, "$$ROOT"]
         }
      }
   },
   {
      $project: {
         variations: 0
      }
   },
   {
      $match: { stock: "in" }
   },
   {
      $project: {
         title: { $ifNull: ["$vTitle", "$title"] },
         slug: 1,
         image: 1,
         brand: 1,
         score: 1,
         sales: 1,
         views: 1,
         categories: 1,
         rating: 1,
         ratingAverage: 1,
         ratingCount: {
            $reduce: {
               input: "$rating",
               initialValue: 0,
               in: { $add: ["$$value", "$$this.count"] }
            }
         },
         sku: "$sku",
         stock: "$stock",
         attributes: "$attributes",
         shipping: 1,
         stockPrice: "$stockPrice",
         sellPrice: "$sellPrice"
      }
   },

]

module.exports.store_products_pipe = (page: any, Filter: any, sortList: any) => {

   page = parseInt(page);
   page = page === 1 ? 0 : page - 1;

   return [
      { $match: { $and: [{ status: "Active" }, { isVerified: true }] } },
      ...basicProductQuery,
      sortList,
      { $skip: 1 * page },
      { $limit: 1 }
   ]
}

module.exports.product_detail_pipe = (productID: string, sku: string) => {
   return [
      { $match: { $and: [{ _id: mongoDB.ObjectId(productID) }, { status: "Active" }] } },
      variationTables,
      {
         $addFields: {
            swatch: {
               $cond: {
                  if: { $eq: ["$productType", "single"] },
                  then: [],
                  else: {
                     $map: {
                        input: "$variations",
                        as: "vars",
                        in: {
                           attributes: "$$vars.attributes",
                           sku: "$$vars.sku",
                           stock: "$$vars.stock"
                        }
                     }
                  }
               }
            },
            variation: {
               $arrayElemAt: [{
                  $filter: {
                     input: "$variations",
                     as: "vars",
                     cond: { $eq: ["$$vars.sku", sku] }
                  }
               }, 0]
            }
         }
      },
      {
         $lookup: {
            from: 'stores',
            localField: 'storeId',
            foreignField: '_id',
            as: 'store'
         }
      },
      { $replaceRoot: { newRoot: { $mergeObjects: [{ $arrayElemAt: ["$store", 0] }, "$$ROOT"] } } },
      {
         $project: {
            title: { $ifNull: ["$variation.vTitle", "$title"] },
            slug: 1,
            swatch: 1,
            variation: 1,
            fulfilledBy: "$shipping.fulfilledBy",
            specification: 1,
            brand: 1,
            status: 1,
            score: 1,
            sales: 1,
            views: 1,
            categories: 1,
            storeId: 1,
            storeTitle: 1,
            supplierPhone: "$contactPhone",
            images: 1,
            rating: 1,
            ratingAverage: 1,
            ratingCount: {
               $reduce: {
                  input: "$rating",
                  initialValue: 0,
                  in: { $add: ["$$value", "$$this.count"] }
               }
            },
            metaDescription: 1,
            description: 1,
            manufacturer: 1,
            highlights: 1,
            volumetricWeight: "$packaged.volumetricWeight",
            weight: "$packaged.weight",
            weightUnit: "$packaged.weightUnit"
         }
      }
   ]
}


module.exports.product_detail_relate_pipe = (productId: string, categories: any[]) => {
   return [
      { $match: { $and: [{ categories: { $in: categories } }, { _id: { $ne: mongoDB.ObjectId(productId) } }, { status: "Active" }] } },
      ...basicProductQuery,
      {
         $limit: 10
      },

   ]
}


module.exports.home_store_product_pipe = (totalLimit: number) => {

   return [
      { $match: { $and: [{ status: "Active" }, { isVerified: true }] } },
      ...basicProductQuery,
      {
         $limit: totalLimit
      }
   ]
}


module.exports.search_product_pipe = (q: any) => {
   return [
      { $match: { status: "Active" } },
      { $unwind: { path: "$variations" } },
      {
         $match: {
            $or: [
               { title: { $regex: q, $options: "i" } },
               { brand: { $regex: q, $options: "i" } },
               { categories: { $in: [q] } },
            ],
         },
      },
      {
         $project: {
            title: 1,
            categories: 1,
            sku: "$variations.sku",
            imageUrl: { $arrayElemAt: ["$imageUrls", 0] },
            slug: 1
         },
      },
   ]
}


module.exports.ctg_filter_product_pipe = (category: any) => {
   return [
      {
         $match: { categories: { $all: category } }
      },
      {
         $addFields: {
            variations: {
               $arrayElemAt: [{
                  $filter: {
                     input: "$variations",
                     cond: { $eq: ["$$v.stock", "in"] },
                     as: "v"
                  }
               }, 0]
            },
         },
      },
      {
         $project: {
            _id: 0,
            brand: 1,
            variant: "$variations.variant"
         }
      }
   ]
}


module.exports.ctg_main_product_pipe = (filters: any, sorting: any) => {
   return [
      { $match: filters },
      {
         $addFields: {
            variation: {
               $cond: {
                  if: { $eq: ["$productType", "single"] },
                  then: productTypeSingle,
                  else: {
                     $arrayElemAt: [{
                        $filter: {
                           input: "$variations",
                           cond: { $eq: ["$$v.stock", "in"] },
                           as: "v"
                        }
                     }, 0]
                  }
               }
            },
         },
      },
      { $project: basicProductProject },
      sorting
   ]
}


module.exports.single_purchase_pipe = (productId: string, sku: string, quantity: number) => {

   return [
      { $match: { $and: [{ _id: mongoDB.ObjectId(productId) }, { status: "Active" }] } },
      {
         $addFields: {
            variation: {
               $cond: {
                  if: { $eq: ["$productType", "single"] },
                  then: productTypeSingle,
                  else: {
                     $arrayElemAt: [{
                        $filter: {
                           input: "$variations",
                           cond: { $eq: ['$$variation.sku', sku] },
                           as: "variation"
                        }
                     }, 0]
                  }
               }

            }
         },
      },
      {
         $match: {
            $expr: {
               $and: [
                  { $eq: ['$variation.stock', 'in'] },
                  { $gte: ['$variation.stockQuantity', quantity] }
               ]
            }
         }
      },
      {
         $project: {
            productId: "$_id",
            _id: 0,
            shipping: 1,
            packaged: 1,
            storeId: 1,
            storeTitle: 1,
            title: "$variation.title",
            brand: 1,
            sku: "$variation.sku",
            image: "$variation.image",
            amount: { $multiply: ["$variation.sellPrice", quantity] },
            savingAmount: { $multiply: [{ $subtract: ["$variation.stockPrice", "$variation.sellPrice"] }, quantity] },
            initialDiscount: "$variation.discount",
            attributes: "$variation.attributes",
            sellPrice: "$variation.sellPrice",
            stockPrice: "$variation.stockPrice",
            stockQuantity: "$variation.stockQuantity",
            stock: "$variation.stock"
         }
      },
      {
         $set: {
            quantity,
            itemId: Math.round(Math.random() * 9999999999)
         }
      }
   ]
}



// Shopping cart pipeline
module.exports.shopping_cart_pipe = (customerId: string, action: any = null) => {

   let arr: any[] = [
      { $match: { customerId: mongoDB.ObjectId(customerId) } },
      {
         $lookup: {
            from: "PRODUCT_VARIATION_TBL",
            let: { mainProductId: "$productId", sku: "$sku" },
            pipeline: [
               {
                  $match:
                  {
                     $expr:
                     {
                        $and: [
                           { $eq: ["$productId", "$$mainProductId"] },
                           { $eq: ["$sku", "$$sku"] },
                           { $eq: ["$stock", "in"] }
                        ]
                     }
                  }
               },
               { $project: { productId: 0, _id: 0 } }
            ],
            as: "variations"
         }
      },
      {
         $replaceRoot: {
            newRoot: {
               $mergeObjects: [{
                  $arrayElemAt: [{
                     $ifNull: ["$variations", []]
                  }, 0]
               }, "$$ROOT"]
            }
         }
      },
      { $unset: ["variations"] },

      { $match: { stock: 'in' } }
   ];

   if (action === "purchasing") {
      arr.push({
         $lookup: {
            from: "STORE_TBL",
            localField: "storeId",
            foreignField: "_id",
            as: "supplierStore"
         }
      }, {
         $addFields: {
            store: {
               $ifNull: [
                  {
                     $arrayElemAt: [
                        "$supplierStore"
                        , 0]
                  }, {}
               ]
            }
         }
      },
         {
            $unset: ["supplierStore"]
         }
      );
   }

   arr.push({
      $project: {
         title: { $ifNull: ["$vTitle", "$title"] },
         brand: 1,
         quantity: 1,
         productId: 1,
         storeId: 1,
         storeTitle: 1,
         sku: 1,
         customerId: 1,
         savingAmount: { $multiply: [{ $subtract: ["$stockPrice", "$sellPrice"] }, '$quantity'] },
         image: 1,
         amount: { $multiply: ["$sellPrice", '$quantity'] },
         initialDiscount: "$discount",
         sellPrice: "$sellPrice",
         stockPrice: "$stockPrice",
         attributes: "$attributes",
         stockQuantity: "$stockQuantity",
         stock: "$stock",
         productType: 1,
         supplierEmail: {
            $ifNull: ["$store.contactEmail", null]
         }
      }
   });

   if (action === "purchasing") {
      arr.push({
         $group: {
            _id: "$storeId",
            storeTitle: { $first: "$storeTitle" },
            totalAmount: { $sum: "$amount" },
            items: { $push: "$$ROOT" }
         }
      });
   }


   return arr;
}


/**
 * 
 */
module.exports.product_detail_review_pipe = (pid: string, sku: string) => {
   return [
      { $match: { _id: mongoDB.ObjectId(pid) } },
      {
         $addFields: {
            variation: {
               $cond: {
                  if: { $eq: ["$productType", "single"] },
                  then: productTypeSingle,
                  else: {
                     $arrayElemAt: [
                        {
                           $filter: {
                              input: "$variations",
                              as: "variant",
                              cond: {
                                 $eq: ["$$variant.sku", sku]
                              }
                           }
                        },
                        0
                     ]
                  }
               }
            }
         }
      }, {
         $project: basicProductProject
      }
   ]
}