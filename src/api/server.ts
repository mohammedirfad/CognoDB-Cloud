import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { benchmarkRouter } from "./routes/benchmark.routes";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";

export function createServer() {
  const app = express();

  // Trust proxy so rate limiting / logging see the real client IP behind a
  // load balancer (Render, Fly, etc.) rather than the proxy's address.
  app.set("trust proxy", 1);

  app.use((req, res, next) => {
    const requestId = req.header("x-request-id") ?? randomUUID();
    res.setHeader("x-request-id", requestId);
    next();
  });

  app.use(helmet());

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.CORS_ALLOWED_ORIGINS.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: "1mb" }));

  const limiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "TooManyRequests", message: "Rate limit exceeded, slow down" },
  });
  app.use(limiter);

  app.use((req, _res, next) => {
    logger.info({ method: req.method, path: req.path }, "request");
    next();
  });

  app.get("/health", (_req, res) => res.json({ status: "ok", uptimeSeconds: process.uptime() }));

  app.use("/api/v1", benchmarkRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

if (require.main === module) {
  const app = createServer();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, "API server listening");
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "shutting down");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
