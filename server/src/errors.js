export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = error.status || (error.name === "ZodError" ? 400 : 500);
  if (status >= 500) console.error(error);
  res.status(status).json({
    error: {
      message:
        status === 500 ? "An unexpected server error occurred." : error.message,
      ...(error.name === "ZodError"
        ? {
            details: error.issues.map(({ path, message }) => ({
              path: path.join("."),
              message,
            })),
          }
        : {}),
      ...(error.details ? { details: error.details } : {}),
    },
  });
}
