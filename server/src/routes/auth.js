import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { ApiError } from "../errors.js";
import { clearAuthCookie, requireAuth, setAuthCookie } from "../auth.js";
import {
  loginSchema,
  profileSchema,
  registrationSchema,
} from "../validation.js";

export const authRouter = Router();
const safeUser = ({
  id,
  name,
  email,
  role,
  phone,
  shareContact,
  village,
  district,
  createdAt,
}) => ({
  id,
  name,
  email,
  role,
  phone,
  shareContact,
  village,
  district,
  createdAt,
});

authRouter.post("/register", async (req, res) => {
  const data = registrationSchema.parse(req.body);
  const email = data.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } }))
    throw new ApiError(409, "An account with this email already exists.");
  const passwordHash = await bcrypt.hash(data.password, 12);
  let user;
  try {
    user = await prisma.user.create({
      data: {
        name: data.name,
        email,
        passwordHash,
        role: data.role,
        phone: data.phone,
        shareContact: data.shareContact,
        village: data.village,
        district: data.district,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        shareContact: true,
        village: true,
        district: true,
        createdAt: true,
      },
    });
  } catch (error) {
    if (error.code === "P2002")
      throw new ApiError(409, "An account with this email already exists.");
    throw error;
  }
  setAuthCookie(res, user.id);
  res.status(201).json({ data: { user } });
});

authRouter.post("/login", async (req, res) => {
  const data = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });
  if (!user || !(await bcrypt.compare(data.password, user.passwordHash)))
    throw new ApiError(401, "Email or password is incorrect.");
  setAuthCookie(res, user.id);
  res.json({ data: { user: safeUser(user) } });
});

authRouter.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ data: { loggedOut: true } });
});

authRouter.get("/me", requireAuth, (req, res) =>
  res.json({ data: { user: safeUser(req.user) } }),
);

authRouter.patch("/me", requireAuth, async (req, res) => {
  const data = profileSchema.parse(req.body);
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      shareContact: true,
      village: true,
      district: true,
      createdAt: true,
    },
  });
  res.json({ data: { user } });
});
