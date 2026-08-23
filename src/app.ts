import cookieParser from "cookie-parser";
import express, { type Request, type Response } from "express";

import { errorHandler } from "./middleware/errorHandler.ts";
import { authRouter } from "./routes/auth.ts";
import { bookingsRouter } from "./routes/bookings.ts";
import { eventsRouter } from "./routes/events.ts";
import { venuesRouter } from "./routes/venues.ts";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_request: Request, response: Response) => {
    response.status(200).json({ status: "ok", uptime: process.uptime() });
  });

  app.use("/v1/auth", authRouter);
  app.use("/v1/venues", venuesRouter);
  app.use("/v1/events", eventsRouter);
  app.use("/v1/bookings", bookingsRouter);
  app.use(errorHandler);
  return app;
}
