import type { Response } from "express";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_REQUIRED"
  | "INVALID_CREDENTIALS"
  | "CONFLICT"
  | "CSRF_TOKEN_INVALID"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export type ErrorDetail = {
  field?: string;
  message: string;
};

export function errorBody(code: ErrorCode, message: string, details: ErrorDetail[] = []) {
  return {
    error: {
      code,
      message,
      details
    }
  };
}

export function sendError(res: Response, status: number, code: ErrorCode, message: string, details: ErrorDetail[] = []) {
  res.status(status).json(errorBody(code, message, details));
}
