import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/http-error';
import { sendError } from '../utils/response';

export const notFoundHandler = (_req: Request, res: Response): void => {
  sendError(res, 'Not Found', 404, 40400);
};

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  void _next;

  if (error instanceof HttpError) {
    sendError(res, error.message, error.statusCode, error.code);
    return;
  }

  if (error instanceof Error) {
    sendError(res, 'Internal Server Error', 500, 50000, error.message);
    return;
  }

  sendError(res, 'Internal Server Error', 500, 50000);
};
