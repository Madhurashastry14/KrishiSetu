import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { ApiError } from "./errors.js";

const cookieOptions = {
  httpOnly: true,
  secure: config.NODE_ENV === "production",
  sameSite: "lax",
  path: "/"
};

export function setAuthCookie(res, userId) {
  const token = jwt.sign({ sub: userId }, config.JWT_SECRET, { expiresIn: "15m" });
  res.cookie("krishisetu_session", token, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
}

export function clearAuthCookie(res) {
  res.clearCookie("krishisetu_session", cookieOptions);
}

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies.krishisetu_session;
    if (!token) throw new ApiError(401, "Please sign in to continue.");
    const payload = jwt.verify(token, config.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new ApiError(401, "Your session is no longer valid. Please sign in again.");
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    if (["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(error.name)) {
      return next(new ApiError(401, "Your session is invalid or has expired."));
    }
    next(error);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return next(new ApiError(403, "You do not have permission to perform this action."));
    next();
  };
}
