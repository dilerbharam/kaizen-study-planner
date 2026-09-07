const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const AUTH_COOKIE_NAME = "kaizen_auth";
const PASSWORD_SALT_ROUNDS = 12;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      "JWT_SECRET is not configured."
    );
  }

  return secret;
}

async function hashPassword(password) {
  return bcrypt.hash(
    password,
    PASSWORD_SALT_ROUNDS
  );
}

async function verifyPassword(
  password,
  passwordHash
) {
  if (!passwordHash) {
    return false;
  }

  return bcrypt.compare(
    password,
    passwordHash
  );
}

function createAuthToken(userId) {
  return jwt.sign(
    {},
    getJwtSecret(),
    {
      subject: String(userId),
      expiresIn:
        process.env.JWT_EXPIRES_IN || "8h",
    }
  );
}

function verifyAuthToken(token) {
  return jwt.verify(
    token,
    getJwtSecret()
  );
}

function getAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure:
      process.env.NODE_ENV ===
      "production",
    path: "/",
  };
}

module.exports = {
  AUTH_COOKIE_NAME,
  hashPassword,
  verifyPassword,
  createAuthToken,
  verifyAuthToken,
  getAuthCookieOptions,
};