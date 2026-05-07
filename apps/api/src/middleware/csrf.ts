import { randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { sendError } from "../http/errorResponse.js";

const CSRF_HEADER = "x-csrf-token";

function createCsrfToken() {
  return randomBytes(32).toString("base64url");
}

function tokensMatch(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

export function ensureCsrfToken(req: Request) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = createCsrfToken();
  }
  return req.session.csrfToken;
}

export function csrfTokenRoute(req: Request, res: Response) {
  res.json({ csrfToken: ensureCsrfToken(req) });
}

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  const expected = req.session.csrfToken;
  const provided = req.header(CSRF_HEADER);

  if (!expected || !provided || !tokensMatch(expected, provided)) {
    sendError(res, 403, "CSRF_TOKEN_INVALID", "CSRF token is missing or invalid");
    return;
  }

  next();
}
