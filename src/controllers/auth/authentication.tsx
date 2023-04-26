// src/controllers/auth/authentication.tsx

import { NextFunction, Request, Response } from "express";
const User = require("../../model/user.model");
const apiResponse = require("../../errors/apiResponse");
const setToken = require("../../utils/setToken");
const comparePassword = require("../../utils/comparePassword");
const setUserDataToken = require("../../utils/setUserDataToken");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const email_service = require("../../services/email.service");
const { isPasswordValid } = require("../../services/common.service");
const { verify_email_html_template } = require("../../templates/email.template");
const { generateUUID, generateExpireTime, generateSixDigitNumber } = require("../../utils/common");
const { isValidString, isValidEmail } = require("../../utils/validate");

/**
 * @apiController --> Buyer Registration Controller
 * @apiMethod --> POST
 * @apiRequired --> BODY
 */
module.exports.buyerRegistrationController = async (req: Request, res: Response, next: NextFunction) => {
   try {

      let body = req.body;

      let existUser = await User.findOne({ $or: [{ phone: body?.phone }, { email: body.email }] });

      if (existUser)
         throw new apiResponse.Api400Error("User already exists, Please try another phone number or email address !");

      body['_uuid'] = "b" + generateUUID();
      body['verificationCode'] = generateSixDigitNumber();
      body['verificationExpiredAt'] = generateExpireTime();
      body["buyer"] = {};
      body["password"] = await bcrypt.hash(body?.password, saltRounds);
      body["accountStatus"] = "inactive";
      body["hasPassword"] = true;
      body["contactEmail"] = body?.email;
      body["idFor"] = "buy";
      body["role"] = "BUYER";
      body["authProvider"] = "system";


      const info = await email_service({
         to: body?.email,
         subject: "Verify email address",
         html: verify_email_html_template(body?.verificationCode)
      });

      if (info?.response) {
         let user = new User(body);
         user.store = undefined;
         const result = await user.save();
         return res.status(200).send({
            success: true,
            statusCode: 200,
            returnEmail: body?.email,
            verificationExpiredAt: result?.verificationExpiredAt,
            message: "Thanks for your information. Verification email was sent to " + body?.email + ". Please verify your account.",
         });
      }

      throw new apiResponse.Api500Error("Sorry registration failed !");

   } catch (error: any) {
      next(error);
   }
};



/**
 * @apiController --> Seller Registration Controller
 * @apiMethod --> POST
 * @apiRequired --> BODY
 */
module.exports.sellerRegistrationController = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{5,}$/;

      let body = req.body;

      const { email, phone, fullName, password, store } = body;

      if (!email) throw new apiResponse.Api400Error("Required email address !");

      if (!isValidEmail(email)) throw new apiResponse.Api400Error("Required valid email address !");

      if (!password)
         throw new apiResponse.Api400Error(`Required password !`);

      if (password && typeof password !== "string")
         throw new apiResponse.Api400Error("Password should be string !");

      if (password.length < 5 || password.length > 8)
         throw new apiResponse.Api400Error("Password length should be 5 to 8 characters !");

      if (!passwordRegex.test(password))
         throw new apiResponse.Api400Error("Password should contains at least 1 digit, lowercase letter, special character !");

      let existUser = await User.findOne({ $or: [{ email }, { phone }] });

      if (existUser) {
         throw new apiResponse.Api400Error("User already exists, Please try another phone number or email address !")
      }

      if (!isPasswordValid) throw new apiResponse.Api400Error("Need a strong password !");

      body['_uuid'] = "s" + generateUUID();
      body['authProvider'] = 'system';
      body['idFor'] = 'sell';
      body["role"] = "SELLER";
      body["contactEmail"] = email;
      body['verificationCode'] = generateSixDigitNumber();
      body['verificationExpiredAt'] = generateExpireTime();
      body["accountStatus"] = "inactive";
      body["store"] = store || {};
      body["password"] = await bcrypt.hash(password, saltRounds);;
      body["hasPassword"] = true;


      const info = await email_service({
         to: email,
         subject: "Verify email address",
         html: verify_email_html_template(body?.verificationCode)
      });

      if (info?.response) {
         let user = new User(body);
         user.buyer = undefined;
         const result = await user.save();

         return res.status(200).send({
            success: true,
            statusCode: 200,
            returnEmail: email,
            verificationExpiredAt: result?.verificationExpiredAt,
            message: "Thanks for your information. Verification code was sent to " + email + ". Please verify your account.",
         });
      }

      throw new apiResponse.Api500Error("Sorry registration failed !");

   } catch (error: any) {
      next(error);
   }
};


module.exports.generateNewVerificationCode = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const { email } = req.query;

      if (!email) throw new apiResponse.Api400Error("Required email address !");

      if (!isValidEmail(email)) throw new apiResponse.Api400Error("Required valid email address !");

      let user = await User.findOne({ email });

      if (!user) throw new apiResponse.Api400Error("Sorry user not found !");

      if (user?.verificationCode || user?.accountStatus === "inactive") {

         user.verificationCode = generateSixDigitNumber();
         user.verificationExpiredAt = generateExpireTime();

         let updateUser = await user.save();

         if (updateUser?.verificationCode) {
            const info = await email_service({
               to: user?.email,
               subject: "Verify email address",
               html: verify_email_html_template(updateUser?.verificationCode)
            });

            if (info?.response) {
               return res.status(200).send({
                  success: true,
                  statusCode: 200,
                  returnEmail: updateUser?.email,
                  verificationExpiredAt: updateUser?.verificationExpiredAt,
                  message: "Email was sent to " + updateUser?.email + ". Please verify your account.",
               });
            }

            throw new apiResponse.Api500Error("Internal error !");
         }
      }

      throw new apiResponse.Api400Error(`Your account with ${email} already active.`);

   } catch (error: any) {
      next(error);
   }
}

/**
 * @controller --> registration verify by token
 */
module.exports.userEmailVerificationController = async (req: Request, res: Response, next: NextFunction) => {
   try {

      const { verificationCode, verificationExpiredAt, email } = req.body;

      if (!verificationCode) throw new apiResponse.Api400Error("Required verification code !");

      if (new Date(verificationExpiredAt) < new Date()) throw new apiResponse.Api400Error("Session expired ! resend code ..");

      let user = await User.findOne({ $and: [{ verificationCode }, { email }] });

      if (!user) {
         throw new apiResponse.Api400Error("Session expired ! resend code ..");
      }

      user.verificationCode = undefined;
      user.verificationExpiredAt = undefined;
      user.accountStatus = "active";

      const result = await user.save();

      return result && res.status(200).send({ success: true, statusCode: 200, message: "Verification successful.", returnEmail: email });

   } catch (error) {
      next(error);
   }
}



/**
 * @apiController --> All User Login Controller
 * @apiMethod --> POST
 * @apiRequired --> BODY
 */
module.exports.loginController = async (req: Request, res: Response, next: NextFunction) => {
   try {

      const { emailOrPhone, password } = req.body;

      if (!isValidString(emailOrPhone)) throw new apiResponse.Api400Error("Invalid string type !");

      let userDataToken: any;

      let user = await User.findOne({ $or: [{ email: emailOrPhone }, { phone: emailOrPhone }] });

      if (!user) throw new apiResponse.Api400Error(`User with ${emailOrPhone} not found!`);

      if (user?.verificationCode || user?.accountStatus === "inactive") {

         user.verificationCode = generateSixDigitNumber();
         user.verificationExpiredAt = generateExpireTime();

         let updateUser = await user.save();

         const info = await email_service({
            to: user?.email,
            subject: "Verify email address",
            html: verify_email_html_template(updateUser?.verificationCode, user?._uuid)
         });

         if (info?.response) {
            return res.status(200).send({
               success: true,
               statusCode: 200,
               returnEmail: updateUser?.email,
               verificationExpiredAt: updateUser?.verificationExpiredAt,
               message: "Email was sent to " + updateUser?.email + ". Please verify your account.",
            });
         }

         throw new apiResponse.Api500Error("Internal error !");
      }

      let comparedPassword = await comparePassword(password, user?.password);

      if (!comparedPassword) throw new apiResponse.Api400Error("Password didn't match !");

      let token = setToken(user);

      if (user?.role && user?.role === "ADMIN") {
         userDataToken = setUserDataToken({
            _uuid: user?._uuid,
            fullName: user?.fullName,
            email: user?.email,
            phone: user?.phone,
            phonePrefixCode: user?.phonePrefixCode,
            hasPassword: user?.hasPassword,
            role: user?.role,
            gender: user?.gender,
            dob: user?.dob,
            accountStatus: user?.accountStatus,
            contactEmail: user?.contactEmail,
            authProvider: user?.authProvider
         });
      }

      if (user?.role && user?.role === "SELLER") {
         userDataToken = setUserDataToken({
            _uuid: user?._uuid,
            fullName: user?.fullName,
            email: user?.email,
            phone: user?.phone,
            phonePrefixCode: user?.phonePrefixCode,
            hasPassword: user?.hasPassword,
            role: user?.role,
            gender: user?.gender,
            dob: user?.dob,
            idFor: user?.idFor,
            isSeller: user?.isSeller,
            accountStatus: user?.accountStatus,
            contactEmail: user?.contactEmail,
            seller: user?.seller,
            authProvider: user?.authProvider
         });
      }

      if (user?.role && user?.role === "BUYER") {

         user.buyer["defaultShippingAddress"] = (Array.isArray(user?.buyer?.shippingAddress) &&
            user?.buyer?.shippingAddress.find((adr: any) => adr?.default_shipping_address === true)) || {};

         userDataToken = setUserDataToken({
            _uuid: user?._uuid,
            fullName: user?.fullName,
            email: user?.email,
            phone: user?.phone,
            phonePrefixCode: user?.phonePrefixCode,
            hasPassword: user?.hasPassword,
            role: user?.role,
            gender: user?.gender,
            dob: user?.dob,
            idFor: user?.idFor,
            accountStatus: user?.accountStatus,
            contactEmail: user?.contactEmail,
            buyer: user?.buyer,
            authProvider: user?.authProvider
         });
      }

      if (token) {
         // if token then set it to client cookie
         res.cookie("token", token, {
            sameSite: "none",
            secure: true,
            maxAge: 57600000,  // 16hr [3600000 -> 1hr]ms
            httpOnly: true
         });

         // if all operation success then return the response

         return res.status(200).send({ success: true, statusCode: 200, name: "isLogin", message: "LoginSuccess", uuid: user?._uuid, u_data: userDataToken, token });
      }
   } catch (error: any) {
      return next(error);
   }
};


/**
 * @apiController --> Sign Out Users Controller
 * @apiMethod --> POST
 * @apiRequired --> BODY
 */
module.exports.signOutController = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const { token } = req.cookies; // finding token in http only cookies.

      if (token && typeof token !== "undefined") {
         res.clearCookie("token");
         return res.status(200).send({ success: true, statusCode: 200, message: "Sign out successfully" });
      }

      throw new apiResponse.Api400Error("You already logged out !");
   } catch (error: any) {
      next(error);
   }
};


/**
 * @apiController --> Password change controller
 * @apiMethod --> POST
 * @apiRequired --> body {old-password, new-password}
 */
module.exports.changePasswordController = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const authEmail = req.decoded.email;

      let result: any;

      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword)
         throw new apiResponse.Api400Error(`Required old password and new password !`);

      if (newPassword && typeof newPassword !== "string")
         throw new apiResponse.Api400Error("Password should be string !");

      if (newPassword.length < 5 || newPassword.length > 8)
         throw new apiResponse.Api400Error("Password length should be 5 to 8 characters !");

      if (!isPasswordValid(newPassword))
         throw new apiResponse.Api400Error("Password should contains at least 1 digit, lowercase letter, special character !");

      // find user in user db
      const user = await User.findOne({ email: authEmail });

      if (!user && typeof user !== "object")
         throw new apiResponse.Api404Error(`User not found!`);

      const comparedPassword = await comparePassword(oldPassword, user?.password);

      if (!comparedPassword) {
         throw new apiResponse.Api400Error("Password didn't match !");
      }

      let hashedPwd = await bcrypt.hash(newPassword, saltRounds);

      if (hashedPwd) {
         result = await User.findOneAndUpdate(
            { email: authEmail },
            { $set: { password: hashedPwd } },
            { upsert: true }
         );
      }

      if (result) return res.status(200).send({ success: true, statusCode: 200, message: "Password updated successfully." });

   } catch (error: any) {
      next(error);
   }
}


module.exports.checkUserAuthentication = async (req: Request, res: Response, next: NextFunction) => {
   try {

      const body = req.body;

      if (!body || typeof body === "undefined") throw new apiResponse.Api400Error("Required body !");

      const { email } = body;

      const user = await User.findOne({ email });

      if (!user || typeof user === "undefined") throw new apiResponse.Api404Error("Sorry user not found with this " + email);

      let securityCode = generateSixDigitNumber();
      let lifeTime = 300000;

      const mailOptions = {
         from: process.env.GMAIL_USER,
         to: email, // the user email
         subject: 'Reset your WooKart Password',
         html: `<p>Your Security Code is <b>${securityCode}</b> and expire in 5 minutes.</p>`
      }

      const info = await email_service({
         to: email, // the user email
         subject: 'Reset your WooKart Password',
         html: `<p>Your Security Code is <b>${securityCode}</b> and expire in 5 minutes.</p>`
      })

      if (info?.response) {
         res.cookie("securityCode", securityCode, { httpOnly: true, sameSite: "none", secure: true, maxAge: lifeTime });

         return res.status(200).send({
            success: true,
            statusCode: 200,
            message: "We have to send security code to your email..",
            lifeTime,
            email
         });
      } else {
         throw new apiResponse.Api500Error("Sorry ! Something wrong in your email. please provide valid email address.");
      }

   } catch (error: any) {
      next(error);
   }
}


module.exports.checkUserForgotPwdSecurityKey = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const sCode = req.cookies.securityCode;

      if (!sCode) throw new apiResponse.Api400Error("Security code is expired !");

      if (!req.body || typeof req.body === "undefined") throw new apiResponse.Api400Error("Required body !");

      const { email, securityCode } = req.body;

      if (!email) throw new apiResponse.Api400Error("Required email !");

      if (!securityCode)
         throw new apiResponse.Api400Error("Required security code !");

      const user = await User.findOne({ email });

      if (!user || typeof user === "undefined")
         throw new apiResponse.Api404Error("Sorry user not found with this " + email);

      if (securityCode !== sCode)
         throw new apiResponse.Api400Error("Invalid security code !");


      res.clearCookie("securityCode");
      let life = 120000;
      res.cookie("set_new_pwd_session", securityCode, { httpOnly: true, sameSite: "none", secure: true, maxAge: life });

      return res.status(200).send({ success: true, statusCode: 200, message: "Success. Please set a new password.", data: { email: user?.email, securityCode, sessionLifeTime: life } });

   } catch (error: any) {
      next(error);
   }
}

module.exports.userSetNewPassword = async (req: Request, res: Response, next: NextFunction) => {
   try {
      let set_new_pwd_session = req.cookies.set_new_pwd_session;

      if (!set_new_pwd_session) throw new apiResponse.Api400Error("Sorry ! your session is expired !");

      const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{5,}$/;

      const { email, password, securityCode } = req.body;

      if (securityCode !== set_new_pwd_session) throw new apiResponse.Api400Error("Invalid security code !");

      if (!email) throw new apiResponse.Api400Error("Required email address !");

      if (!password)
         throw new apiResponse.Api400Error(`Required password !`);

      if (password && typeof password !== "string")
         throw new apiResponse.Api400Error("Password should be string !");

      if (password.length < 5 || password.length > 8)
         throw new apiResponse.Api400Error("Password length should be 5 to 8 characters !");

      if (!passwordRegex.test(password))
         throw new apiResponse.Api400Error("Password should contains at least 1 digit, lowercase letter, special character !");

      const user = await User.findOne({ email });

      if (!user && typeof user !== "object") {
         throw new apiResponse.Api404Error(`User not found!`);
      }

      let hashedPwd = await bcrypt.hash(password, saltRounds);

      let result = hashedPwd ? await User.findOneAndUpdate(
         { email },
         { $set: { password: hashedPwd } },
         { upsert: true }
      ) : false;

      res.clearCookie('set_new_pwd_session');

      if (!result) throw new apiResponse.Api500Error("Something wrong in server !");

      return result && res.status(200).send({ success: true, statusCode: 200, message: "Password updated successfully." });

   } catch (error: any) {
      next(error);
   }
}