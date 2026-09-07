const {
  AUTH_COOKIE_NAME,
  verifyAuthToken,
} = require("../services/authService");

function authenticate(req, res, next) {
  const token =
    req.cookies?.[AUTH_COOKIE_NAME];

  if (!token) {
    return res.status(401).json({
      error: "Authentication required.",
    });
  }

  try {
    const payload =
      verifyAuthToken(token);

    const userId =
      Number(payload.sub);

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return res.status(401).json({
        error:
          "Invalid authentication token.",
      });
    }

    req.user = {
      id: userId,
    };

    return next();
  } catch {
    return res.status(401).json({
      error:
        "Authentication session is invalid or has expired.",
    });
  }
}

module.exports = authenticate;