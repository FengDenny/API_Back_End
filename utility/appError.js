class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;

    // include all the "this" including the constructor
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
