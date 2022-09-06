import express, { Express, Request, Response } from "express";
var jwt = require("jsonwebtoken");
const { dbh } = require("../database/db");

const verifyJWT = async (req: Request, res: Response, next: any) => {
  const token = req.cookies.token;

  if (token) {
    jwt.verify(
      token,
      process.env.ACCESS_TOKEN,
      function (err: any, decoded: any) {
        if (err) {
          res.clearCookie("token");
          return res.status(401).send({
            message: err.message,
          });
        }
        req.decoded = decoded;
        next();
      }
    );
  } else {
    return res.status(403).send({ message: "Forbidden" });
  }
};

// // verify owner
const verifyAuth = async (req: Request, res: Response, next: any) => {
  await dbh.connect();
  const userCollection = dbh.db("ecommerce-db").collection("users");
  const authEmail = req.decoded.email;
  const findAuthInDB = await userCollection.findOne({
    email: authEmail && authEmail,
  });

  if (findAuthInDB.role === "owner" || findAuthInDB.role === "admin") {
    next();
  } else {
    res.status(403).send({ message: "Forbidden" });
  }
};

// verify seller
const verifySeller = async (req: Request, res: Response, next: any) => {
  await dbh.connect();
  const userCollection = dbh.db("ecommerce-db").collection("users");

  const authEmail = req.decoded.email;
  const findAuthInDB = await userCollection.findOne({
    email: authEmail && authEmail,
  });

  if (findAuthInDB.role === "seller") {
    next();
  } else {
    res.status(403).send({ message: "Forbidden" });
  }
};

// verify seller
const verifyUser = async (req: Request, res: Response, next: any) => {
  await dbh.connect();
  const userCollection = dbh.db("ecommerce-db").collection("users");

  const authEmail = req.decoded.email;
  const findAuthInDB = await userCollection.findOne({
    email: authEmail && authEmail,
  });

  if (findAuthInDB.role === "user") {
    next();
  } else {
    res.status(403).send({ message: "Forbidden" });
  }
};

module.exports = {
  verifyJWT,
  verifyAuth,
  verifySeller,
  verifyUser
};
