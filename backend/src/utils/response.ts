import type { Response } from 'express';

export const sendSuccess = <T>(res: Response, data: T, message = 'success'): void => {
  res.status(200).json({
    code: 0,
    message,
    data
  });
};

export const sendError = (
  res: Response,
  message: string,
  statusCode = 400,
  code = 40000,
  error?: string
): void => {
  res.status(statusCode).json({
    code,
    message,
    ...(error ? { error } : {})
  });
};
