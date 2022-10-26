import { Request, Response } from "express";
var jwt = require("jsonwebtoken");
const { dbConnection } = require("../utils/db");

const verifyAuthUserByJWT = async (req:Request, res:Response, next:any) => {
  const token = req.cookies.token; // finding token in http only cookies.

  // if token not present in cookies then return 403 status code and terminate the request here....
  if (!token || typeof token === "undefined") {
    res.clearCookie('is_logged');
    return res.status(204).send();
  }


  jwt.verify(
    token,
    process.env.ACCESS_TOKEN,
    function (err: any, decoded: any) {
      // verifying the token with jwt verify method and if token broken then 401 status code will send and terminate the request
      if (err) {
        res.clearCookie("token");
        res.clearCookie('is_logged');
        return res.status(401).send({
          success: false,
          statusCode: 401,
          error: err.message,
        });
      }

      // if success then return email throw req.decoded
      req.decoded = decoded;
      next();
    }
  );
}

const verifyJWT = async (req: Request, res: Response, next: any) => {
  const token = req.cookies.token; // finding token in http only cookies.

  // if token not present in cookies then return 403 status code and terminate the request here....
  if (!token || typeof token === "undefined") {
    res.clearCookie('is_logged');
    return res.status(401).send({success: false, statusCode: 401, error: 'Token not found'});
  }


  jwt.verify(
    token,
    process.env.ACCESS_TOKEN,
    function (err: any, decoded: any) {
      // verifying the token with jwt verify method and if token broken then 401 status code will send and terminate the request
      if (err) {
        res.clearCookie("token");
        res.clearCookie('is_logged');
        return res.status(401).send({
          success: false,
          statusCode: 401,
          error: err.message,
        });
      }

      // if success then return email throw req.decoded
      req.decoded = decoded;
      next();
    }
  );
};

// // verify owner
const checkingOwnerOrAdmin = async (req: Request, res: Response, next: any) => {
  const db = await dbConnection();

  const authEmail = req.decoded.email;
  const findAuthInDB = await db.collection("users").findOne({
    email: authEmail && authEmail,
  });

  if (findAuthInDB.role === "owner" || findAuthInDB.role === "admin") {
    next();
  }

  else {
    return res.status(503).send({
      success: false,
      statusCode: 503,
      error:
        "You are not a owner or admin, So you are not authorized for process this.",
    });
  }
};

// verify seller
const checkingSeller = async (req: Request, res: Response, next: any) => {
  const db = await dbConnection();

  const authEmail = req.decoded.email;

  const user = await db.collection('users').findOne({ $and: [{ email: authEmail }, { role: 'seller' }] });

  if (!user) {
    return res.status(503).send({
      success: false,
      statusCode: 503,
      error:
        "You are not a seller, So you are not authorized for process this.",
    });
  }

  req.decoded = { _id: user._id, email: user.email, username: user.username, role: user.role };

  next();
};

// verify seller
const checkingUser = async (req: Request, res: Response, next: any) => {
  const db = await dbConnection();

  const authEmail = req.decoded.email;
  const findAuthInDB = await db.collection("users").findOne({
    email: authEmail && authEmail,
  });

  if (findAuthInDB.role !== "user") {
    return res.status(400).send({
      success: false,
      statusCode: 400,
      error: "You are not a user, So you are not authorized for process this.",
    });
  }

  next();
};

module.exports = {
  verifyJWT,
  checkingOwnerOrAdmin,
  checkingSeller,
  checkingUser,
  verifyAuthUserByJWT
};
