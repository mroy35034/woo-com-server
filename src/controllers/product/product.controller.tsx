import { Request, Response } from "express";
var { dbConnection } = require("../../utils/db");
const { ObjectId } = require("mongodb");
const {
  productUpdateModel,
  productIntroTemplate,
  productImagesModel,
  productRatingTemplate
} = require("../../templates/product.template");
const {
  productCounterAndSetter,
  productCounter,
  topSellingProducts,
  topRatedProducts
} = require("../../model/product.model");

module.exports.searchProducts = async (req: Request, res: Response) => {
  try {
    const db = await dbConnection();

    const q = req.params.q;

    const result =
      (await db
        .collection("products")
        .aggregate([
          {
            $match: {
              $and: [{ status: "active" }, { save_as: "fulfilled" }],
              $or: [
                { title: { $regex: q, $options: "i" } },
                { "seller.name": { $regex: q, $options: "i" } },
                { brand: { $regex: q, $options: "i" } },
                { categories: { $in: [q] } },
              ],
            },
          },
          {
            $project: {
              title: "$title",
              categories: "$categories",
              images: "$images",
            },
          },
        ])
        .toArray()) || [];

    return result.length > 0
      ? res.status(200).send(result)
      : res.status(204).send();
  } catch (error: any) {
    res
      .status(500)
      .send({ success: false, statusCode: 500, error: error?.message });
  }
};

/**
 * @apiName --> count products
 * @required --> Optional (If count by seller then pass the seller query on url)
 */
module.exports.countProductsController = async (
  req: Request,
  res: Response
) => {
  try {
    const seller = req.query.seller;
    let result: any;

    if (seller) {
      result = await productCounter(seller);
    } else {
      result = await productCounter();
    }

    res.status(200).send({ success: true, statusCode: 200, count: result });
  } catch (error: any) {
    console.log(error?.message);
    res
      .status(500)
      .send({ success: false, statusCode: 500, error: error?.message });
  }
};

// Delete product by inventory management
module.exports.deleteProductController = async (
  req: Request,
  res: Response
) => {
  try {
    const db = await dbConnection();
    const user = req.decoded;

    const productId: String = req.headers.authorization || "";

    const deletedProduct = await db
      .collection("products")
      .deleteOne({ _id: ObjectId(productId) }); //return --> "acknowledged" : true, "deletedCount" : 1

    if (!deletedProduct.deletedCount) {
      return res.status(503).send({
        success: false,
        statusCode: 503,
        error: "Service unavailable",
      });
    }

    await productCounterAndSetter(user);

    await db
      .collection("users")
      .updateMany(
        { "shoppingCartItems._id": productId },
        { $pull: { shoppingCartItems: { _id: productId } } }
      );

    return res.status(200).send({
      success: true,
      statusCode: 200,
      message: "Product deleted successfully.",
    });
  } catch (error: any) {
    return res
      .status(500)
      .send({ success: false, statusCode: 500, error: error?.message });
  }
};

module.exports.updateProductController = async (
  req: Request,
  res: Response
) => {
  try {
    const db = await dbConnection();

    const productId: String = req.headers?.authorization || "";
    const body = req.body;
    let model;

    if (body?.images) {
      model = productImagesModel(body);
    } else {
      model = productUpdateModel(body);
    }

    const exists =
      (await db
        .collection("users")
        .find({ "shoppingCartItems._id": productId })
        .toArray()) || [];

    if (exists && exists.length > 0) {
      await db.collection("users").updateMany(
        { "shoppingCartItems._id": productId },
        {
          $pull: { shoppingCartItems: { _id: productId } },
        }
      );
    }

    const result = await db
      .collection("products")
      .updateOne(
        { _id: ObjectId(productId) },
        { $set: model },
        { upsert: true }
      );

    res.status(200).send(result && { message: "Product updated successfully" });
  } catch (error: any) {
    res.status(500).send({ message: error?.message });
  }
};

// Update Product Stock Controller
module.exports.updateStockController = async (req: Request, res: Response) => {
  try {
    const db = await dbConnection();

    const productId: String = req.headers.authorization || "";
    const body = req.body;

    if (productId && body) {
      let stock = body?.available <= 1 ? "out" : "in";

      const result = await db.collection("products").updateOne(
        { _id: ObjectId(productId) },
        {
          $set: {
            "stockInfo.available": body?.available,
            "stockInfo.stock": stock,
          },
        },
        { upsert: true }
      );

      if (!result) {
        return res.status(503).send({
          success: false,
          statusCode: 503,
          error: "Failed to update stock quantity !!!",
        });
      }

      return res.status(200).send({
        success: true,
        statusCode: 200,
        message: "Product stock updated successfully.",
      });
    }
  } catch (error: any) {
    res
      .status(500)
      .send({ success: false, statusCode: 500, error: error?.message });
  }
};

/**
 * Adding Product Title and slug first
 */
module.exports.setProductIntroController = async (
  req: Request,
  res: Response
) => {
  try {
    const db = await dbConnection();
    const authEmail = req.decoded.email;
    const formTypes = req.params.formTypes;
    const body = req.body;
    let model;

    const user = await db
      .collection("users")
      .findOne({ $and: [{ email: authEmail }, { role: "seller" }] });

    if (!user) {
      return res
        .status(401)
        .send({ success: false, statusCode: 401, error: "Unauthorized" });
    }

    if (formTypes === "update" && body?.productId) {
      model = productIntroTemplate(body);

      let result = await db
        .collection("products")
        .updateOne(
          { $and: [{ _id: ObjectId(body?.productId) }, { save_as: "draft" }] },
          { $set: model },
          { upsert: true }
        );

      return result?.acknowledged
        ? res.status(200).send({
          success: true,
          statusCode: 200,
          message: "Product updated successfully.",
        })
        : res.status(400).send({
          success: false,
          statusCode: 400,
          error: "Operation failed!!!",
        });
    }

    if (formTypes === 'create') {

      model = productIntroTemplate(body);
      model["seller"] = {};
      model.seller.uuid = user?._id;
      model.seller.name = user?.username;
      model['createdAt'] = new Date(Date.now());
      model["rating"] = [
        { weight: 5, count: 0 },
        { weight: 4, count: 0 },
        { weight: 3, count: 0 },
        { weight: 2, count: 0 },
        { weight: 1, count: 0 },
      ];
      model["ratingAverage"] = 0;

      let result = await db.collection('products').insertOne(model);
      if (result) {
        await productCounterAndSetter(user);

        return res.status(200).send({
          success: true,
          statusCode: 200,
          message: "Data saved.",
        });
      }
    }
  } catch (error: any) {
    res
      .status(500)
      .send({ success: false, statusCode: 500, error: error.message });
  }
};


/**
 * @controller      --> Home store controller.
 * @required        --> []
 * @request_method  --> GET
 */
module.exports.homeStoreController = async (req: Request, res: Response) => {
  try {
    const db = await dbConnection();
    const totalLimits = parseInt(req.params.limits);

    let allProducts = await db.collection('products').aggregate([
      { $unwind: { path: '$variations' } },
      { $match: { 'variations.status': 'active' } },
      { $sort: { 'variations.vId': -1 } },
      { $limit: totalLimits }
    ]).toArray();


    const topSellingProduct = await topSellingProducts();
    const topRatedProduct = await topRatedProducts();

    return allProducts
      ? res.status(200).send({
        success: true, statusCode: 200, data: {
          store: allProducts,
          topSellingProducts: topSellingProduct,
          topRatedProducts: topRatedProduct
        }
      })
      : res.status(500).send({ success: false, statusCode: 500, error: "Something went wrong" });


  } catch (error: any) {
    return res.status(500).send({ success: false, statusCode: 500, error: error?.message });
  }
}


/**
 * @controller      --> Fetch the single product information in product details page.
 * @required        --> [req.headers.authorization:email, req.query:productId, req.query:variationId, req.params:product slug]
 * @request_method  --> GET
 */
module.exports.fetchSingleProductController = async (req: Request, res: Response) => {
  try {
    const db = await dbConnection();

    const email: String = req.headers.authorization || '';
    const product_slug: String = req.params.product_slug;
    const productId = req.query?.pId;
    const variationId = req.query.vId;
    let inCart: boolean = false;
    let inWishlist: boolean = false;

    // Product Details
    let productDetail = await db.collection('products').aggregate([
      { $match: { _id: ObjectId(productId) } },
      {
        $project: {
          variations: '$variations', swatch: "$variations",
          brand: 1, categories: 1,
          seller: 1, rating: 1, ratingAverage: 1, save_as: 1, createdAt: 1, bodyInfo:1, manufacturer: 1
        }
      },
      { $unwind: { path: '$variations' } },
      { $match: { 'variations.vId': variationId } }
    ]).toArray();

    productDetail = productDetail[0];

    let newProduct = productDetail?.swatch;
    let swatches = [];

    for (let i = 0; i < newProduct.length; i++) {
      let e = newProduct[i];

      swatches.push({
        vId: e.vId,
        slug: e.slug,
        attr: e.attributes
      });
    }

    productDetail.swatch = swatches;

    // Related products
    const relatedProducts = await db.collection("products").aggregate([
      { $unwind: { path: '$variations' } },
      {
        $match: {
          $and: [
            { categories: { $in: productDetail.categories } },
            { 'variations.vId': { $ne: variationId } },
            { 'variations.status': "active" },
          ],
        },
      },
      {
        $project: {
          ratingAverage: "$ratingAverage",
          brand: "$brand",
          variations: {
            vId: "$variations.vId",
            pricing: "$variations.pricing",
            title: "$variations.title",
            slug: "$variations.slug",
            attributes: "$variations.attributes",
            images: "$variations.images"
          }
        },
      },
      { $limit: 5 },
    ]).toArray();

    // If user email address exists
    if (email) {
      const existProductInCart = await db
        .collection("shoppingCarts")
        .findOne({ $and: [{ customerEmail: email }, { vId: variationId }] });

      const existProductInWishlist = await db
        .collection("users")
        .findOne({ $and: [{ email }, { "wishlist.slug": product_slug }] });

      if (existProductInWishlist) {
        inWishlist = true;
      }

      if (existProductInCart && typeof existProductInCart === "object") {
        inCart = true;
      }

      productDetail["inCart"] = inCart;

      productDetail["inWishlist"] = inWishlist;
    }

    return res.status(200).send({
      success: true,
      statusCode: 200,
      data: { product: productDetail, relatedProducts },
    });

  } catch (error: any) {
    return res.status(500).send({ success: false, statusCode: 500, error: error.message });
  }
};


/**
 * @controller      --> Fetch the single product in product edit page.
 * @required        --> [req.query:seller, req.query:productId, req.query:variationId]
 * @request_method  --> GET
 */
module.exports.fetchSingleProductByPidController = async (req: Request, res: Response) => {
  try {
    const db = await dbConnection();

    const productId = req.query.pid;
    const variationId = req.query.vId;
    const seller = req.query.seller;

    let product;

    if (variationId) {
      product = await db.collection('products').aggregate([
        {
          $match: { $and: [{ _id: ObjectId(productId) }, { save_as: "draft" }] }
        },
        {
          $unwind: { path: "$variations" },
        },
        {
          $match: { 'variations.vId': variationId }
        }
      ]).toArray();
      product = product[0];
    } else {
      product = await db.collection("products").findOne({
        $and: [{ _id: ObjectId(productId) }, { "seller.name": seller }],
      });
    }

    return product
      ? res.status(200).send(product)
      : res.status(404).send({
        success: false,
        statusCode: 404,
        error: "Product not found!!!",
      });
  } catch (error: any) {
    return res.status(500).send({ message: error?.message });
  }
};

/**
 * @controller      --> productsByCategoryController
 * @required        --> categories [Optional -> filters query]
 */
module.exports.productsByCategoryController = async (req: Request, res: Response) => {
  try {
    const db = await dbConnection();

    const { categories, filters } = req.query;

    let category: String[] =
      (categories && categories.toString().split(",")) || [];

    let sorting = {};

    if (filters && filters === "lowest") {
      sorting = { $sort: { "variations.pricing.sellingPrice": 1 } };
    } else if (filters && filters === "highest") {
      sorting = { $sort: { "variations.pricing.sellingPrice": -1 } }
    } else {
      sorting = { $sort: { "variations.modifiedAt": 1 } }
    }


    const products = await db.collection("products").aggregate([
      { $unwind: { path: '$variations' } },
      {
        $match: {
          $and: [
            { categories: { $all: category } },
            { 'variations.status': "active" }
          ]
        }
      },
      sorting
    ]).toArray();


    //   .find({
    //   $and: [
    //     { categories: { $all: category } },
    //     { status: "active" },
    //     { save_as: "fulfilled" },
    //   ],
    // })
    // .sort(sorting)
    // .toArray()) || [];

    return products
      ? res.status(200).send(products)
      : res.status(404).send({
        success: false,
        statusCode: 404,
        error: "Products not available.",
      });
  } catch (error: any) {
    return res
      .status(500)
      .send({ success: false, statusCode: 500, error: error?.message });
  }
};

module.exports.fetchTopSellingProduct = async (req: Request, res: Response) => {
  try {
    const db = await dbConnection();

    const seller: any = req.query.seller;
    let filterQuery: any = {
      status: "active",
    };
    if (seller) {
      filterQuery["seller"] = seller;
    }

    const result = await db
      .collection("products")
      .find(filterQuery)
      .sort({ "stockInfo.sold": -1 })
      .limit(6)
      .toArray();
    res.status(200).send(result);
  } catch (error: any) {
    return res.status(500).send({ message: error?.message });
  }
};

module.exports.manageProductController = async (
  req: Request,
  res: Response
) => {
  try {
    const db = await dbConnection();

    const authEmail = req.decoded.email;
    const role = req.decoded.role;

    const isSeller = await db
      .collection("users")
      .findOne({ $and: [{ email: authEmail }, { role }] });

    let item: any;
    let page: any;
    item = req.query.items;
    page = req.query.page;
    let searchText: any = req.query.search;
    let filters: any = req.query.category;
    let cursor: any;
    let products: any;
    let draftProducts: any;

    let showFor: any[];

    if (isSeller.role === "seller") {
      showFor = [
        { "seller.name": isSeller?.username },
        { status: "active" },
        { save_as: "fulfilled" },
      ];
    } else {
      showFor = [{ status: "active" }, { save_as: "fulfilled" }];
    }

    const searchQuery = (sTxt: String) => {
      item = "";
      page = "";
      return {
        $and: showFor,
        $or: [
          { title: { $regex: sTxt, $options: "i" } },
          { "seller.name": { $regex: sTxt, $options: "i" } },
        ],
      };
    };

    const filterQuery = (category: String) => {
      item = "";
      page = "";
      return {
        $and: [
          { categories: { $all: [category] } },
          { status: "active" },
          { save_as: "fulfilled" },
        ],
      };
    };

    page = parseInt(page) === 1 ? 0 : parseInt(page) - 1;

    cursor =
      searchText && searchText.length > 0
        ? db.collection("products").find(searchQuery(searchText))
        : filters && filters !== "all"
          ? db.collection("products").find(filterQuery(filters))
          : db.collection("products").find({ $and: showFor });

    if (item || page) {
      products = await cursor
        .skip(page * parseInt(item))
        .limit(parseInt(item))
        .toArray();
    } else {
      products = await cursor.toArray();
    }

    if (isSeller) {

      // draftProducts = await db.collection('products').aggregate([
      //   {
      //     $match: { $and: [{ "seller.name": isSeller?.username }, { save_as: "draft" }] }
      //   },
      //   {
      //     $unwind: { path: "$variations" },
      //   }
      // ]).toArray();

      draftProducts = await db
        .collection("products")
        .find({
          $and: [{ "seller.name": isSeller?.username }, { save_as: "draft" }],
        })
        .toArray();
    }

    return res.status(200).send({
      success: true,
      statusCode: 200,
      data: { products: products, draftProducts },
    });
  } catch (error: any) {
    return res
      .status(500)
      .send({ success: false, statusCode: 500, error: error?.message });
  }
};

// Dashboard Overview Controller
module.exports.dashboardOverviewController = async (req: Request, res: Response) => {
  try {
    const db = await dbConnection();

    const authEmail: String = req.decoded.email;
    const role: String = req.decoded.role;

    let topSellers: any;
    let topSoldProducts: any;
    let matches: any;

    const user = await db.collection("users").findOne({ $and: [{ email: authEmail }, { role }] });

    if (user?.role === 'seller') {
      matches = { $match: { $and: [{ 'seller.name': user?.username }, { 'stockInfo.sold': { $exists: true } }] } }
    }

    if (user?.role === "admin") {

      topSellers = await db.collection('users').aggregate([
        { $match: { role: "seller" } },
        {
          $project: {
            totalSell: '$inventoryInfo.totalSell',
            username: '$username',
            email: '$email',
            totalProducts: '$inventoryInfo.totalProducts',
          }
        },
        { $sort: { totalSell: -1 } },
        { $limit: 10 }
      ]).toArray();

      matches = { $match: { 'stockInfo.sold': { $exists: true } } }
    }

    topSoldProducts = await db.collection('products').aggregate([
      matches,
      {
        $project: {
          sold: '$stockInfo.sold',
          images: '$images',
          title: '$title',
          seller: '$seller.name',
          sku: '$sku',
          brand: '$brand',
          categories: '$categories',
          pricing: '$pricing'
        }
      },
      { $sort: { sold: -1 } },
      { $limit: 10 }
    ]).toArray();



    return res.status(200).send({ success: true, statusCode: 200, data: { topSellers, topSoldProducts } });

  } catch (error: any) {
    return res
      .status(500)
      .send({ success: false, statusCode: 500, error: error?.message });
  }
};



// product variation controller
module.exports.productVariationController = async (req: Request, res: Response) => {
  try {
    const db = await dbConnection();
    const productId: String = req.headers?.authorization || "";
    const formTypes = req.query.formType || "";
    const vId = req.query.vId;
    const productAttr = req.query.attr;
    let result;
    let model = req.body;

    if (formTypes === 'new-variation') {
      result = await db.collection('products').updateOne(
        {
          _id: ObjectId(productId)
        },
        {
          $push: { variations: model }
        },
        { upsert: true }
      );
    }

    // next condition
    else if (formTypes === 'update') {

      if (vId) {

        if (productAttr === 'variationOne') {
          result = await db.collection('products').updateOne(
            {
              $and: [{ _id: ObjectId(productId) }, { 'variations.vId': vId }]
            },
            {
              $set: {
                'variations.$[i].title': model.title,
                'variations.$[i].slug': model.slug,
                'variations.$[i].images': model.images,
                'variations.$[i].sku': model.sku,
                'variations.$[i].pricing': model.pricing,
                'variations.$[i].stock': model.stock,
                'variations.$[i].available': model.available,
                'variations.$[i].status': model.status,
              }
            },
            { arrayFilters: [{ "i.vId": vId }] }
          );
        }

        if (productAttr === 'variationTwo') {

          result = await db.collection('products').updateOne(
            {
              $and: [{ _id: ObjectId(productId) }, { 'variations.vId': vId }]
            },
            {
              $set: { 'variations.$[i].attributes': model }
            },
            { arrayFilters: [{ "i.vId": vId }] }
          );
        }

        if (productAttr === 'variationThree') {

          result = await db.collection('products').updateOne(
            { _id: ObjectId(productId) },
            {
              $set: { bodyInfo: model }
            },
            { upsert: true }
          );
        }
      }
    }

    if (result) {
      return res.status(200).send({ success: true, statusCode: 200, message: "Data Saved" });
    }
    return res.status(500).send({ success: false, statusCode: 500, error: "Failed" });

  } catch (error: any) {
    return res.status(500).send({ success: false, statusCode: 500, error: error?.message });
  }
}


// delete product variation controller
module.exports.deleteProductVariationController = async (req: Request, res: Response) => {
  try {
    const db = await dbConnection();

    const productId = req.params.productId;
    const vId = req.params.vId;

    const product = await db.collection('products').findOne({ _id: ObjectId(productId) });

    if (!product) {
      return res.status(404).send({ success: false, statusCode: 404, error: 'Sorry! Product not found!!!' });
    }

    const result = await db.collection('products').updateOne(
      { $and: [{ _id: ObjectId(productId) }, { 'variations.vId': vId }] },
      { $pull: { variations: { vId: vId } } }
    );

    if (result) {
      return res.status(200).send({ success: true, statusCode: 200, message: 'Variation deleted successfully.' });
    }

    return res.status(500).send({ success: false, statusCode: 500, message: 'Failed to delete!!!' });

  } catch (error: any) {
    return res.status(500).send({ success: false, statusCode: 500, error: error?.message });
  }
}