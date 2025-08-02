const JWT = require("jsonwebtoken");

const secretKey = process.env.JWT_SECRET;

const createToken = (user) => {
  const { email, fullName, gender, profileImage, userType } = user;

  const userPayload = {
    _id: user._id,
    email: email,
    userType: userType,
  };

  const token = JWT.sign(userPayload, secretKey);
  return token;
};

const verifyToken = (token) => {
  const userPayload = JWT.verify(token, secretKey);
  return userPayload;
};

module.exports = {
  createToken,
  verifyToken,
};
