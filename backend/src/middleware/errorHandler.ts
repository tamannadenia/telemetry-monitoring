import { Request, Response, NextFunction } from 'express';

/**
 * Centralized Express error handler.
 * Services may attach a numeric `statusCode` to thrown Errors.
 */
export function errorHandler(
  err: Error & { statusCode?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.statusCode ?? 500;
  console.error(`[error] ${status} ${err.message}`);
  if (status >= 500) {
    console.error(err.stack);
  }
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
}
