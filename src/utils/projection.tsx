const discount = {
   $toInt: {
      $multiply: [
         {
            $divide: [
               {
                  $subtract: ["$pricing.price", {
                     $add:
                        ["$pricing.sellingPrice", "$variations.priceModifier"]
                  }]
               }, "$pricing.price"]
         }, 100]
   }
}

module.exports.basicProductProject = {
   title: "$variations.vTitle",
   slug: 1,
   brand: 1,
   score: 1,
   sales: 1,
   views: 1,
   categories: 1,
   packageInfo: 1,
   rating: 1,
   ratingAverage: 1,
   _lid: 1,
   reviews: 1,
   image: 1,
   _vrid: "$variations._vrid",
   stock: "$variations.stock",
   variant: "$variations.variant",
   shipping: 1,
   pricing: "$variations.pricing"
}

module.exports.shoppingCartProject = {

   cartID: "$_id",
   _id: 0,
   title: "$variations.vTitle",
   slug: 1,
   packaged: 1,
   listingID: "$items.listingID",
   productID: "$items.productID",
   customerEmail: 1,
   variationID: "$items.variationID",
   shipping: 1,
   brand: 1,
   image: { $first: "$variations.images" },
   sku: "$variations.sku",
   supplier: 1,
   quantity: "$items.quantity",
   savingAmount: { $multiply: [{ $subtract: ["$variations.pricing.price", "$variations.pricing.sellingPrice"] }, '$items.quantity'] },
   baseAmount: { $multiply: ["$variations.pricing.sellingPrice", '$items.quantity'] },
   paymentInfo: 1,
   sellingPrice: "$variations.pricing.sellingPrice",
   price: "$variations.pricing.price",
   variant: "$variations.variant",
   available: "$variations.available",
   stock: "$variations.stock"
}