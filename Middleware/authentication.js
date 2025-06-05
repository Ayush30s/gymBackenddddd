const { verifyToken } = require("../services/auth");

function authenticateUser(cookieName) {
  return (req, res, next) => {
    const tokenCookieValue = req.cookies[cookieName];
    console.log("authenticateUser -> ", tokenCookieValue);

    if (!tokenCookieValue) {
      return next(); // No cookie, proceed without user
    }

    try {
      const userPayload = verifyToken(tokenCookieValue);
      req.user = userPayload;
      console.log("User Authenticated:", userPayload);
    } catch (error) {
      console.error("Token verification failed:", error.message);
    }

    next(); // Ensure next() is always called
  };
}

module.exports = { authenticateUser };
