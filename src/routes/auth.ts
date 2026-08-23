import { Router } from "express";
import { z } from "zod";

import { handleLogin, handleRefresh, handleSignup } from "../controllers/authController.ts";
import { requireTrustedOrigin } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import { rateLimit } from "../middleware/rateLimit.ts";

const authRouter = Router();

const passwordSchema = z.string().min(12).max(128);
const signupSchema = z.strictObject({
  email: z.email(),
  password: passwordSchema,
  name: z.string().trim().min(1).max(100),
});
const loginSchema = z.strictObject({
  email: z.email(),
  password: z.string().min(1).max(128),
});

authRouter.post("/signup", validate(signupSchema), handleSignup);
export const loginRateLimit = { max: 5, windowMs: 60_000 } as const;

authRouter.post(
  "/login",
  rateLimit({ ...loginRateLimit, identity: (request) => request.ip ?? "unknown" }),
  validate(loginSchema),
  handleLogin,
);
authRouter.post("/refresh", requireTrustedOrigin, handleRefresh);

export { authRouter };
