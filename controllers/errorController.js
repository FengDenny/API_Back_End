const AppError = require("./../utility/AppError");

// PRODUCTION ONLY START
const handleValidationError = (err) => {
  const error = Object.values(err.errors).map((element) => element.message);
  const message = `Invalid input data: ${error.join(". ")}`;
  return new AppError(message, 400);
};

// 1100 error code for UNQIUE filed in usermodel
const handleDuplicatedFieldsDB = (err) => {
  const value = err.keyValue.email;
  console.log(value);
  const message = `Email ${value} already exists. Please use another email!`;
  return new AppError(message, 400);
};

// PRODUCTION ONLY END

// Send developement error
const sendDevError = (err, req, res) => {
  // API
  if (req.originalUrl.startsWith("/api")) {
    return res.status(err.statusCode).json({
      statusCode: err.statusCode,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  }

  // Rendered Website
  console.log("ERROR", err);
  return res.status(err.statusCode).send("error", {
    title: "Something went wrong!",
    message: err.message,
  });
};

// Send production error
// if we ned prod mode, we send back status and message to the client
const sendProdError = (err, req, res) => {
  if (req.originalUrl.startsWith("/api/")) {
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
    } else {
      console.log("ERROR ", err);
      //  generic message
      res.status(500).json({
        status: "error",
        message: "There was an issue.",
      });
    }
  }
  // B) Rendered Website
  // Operational, trusted error: send message to client ?(if) true
  if (err.isOperational) {
    return res.status(err.statusCode).send("error", {
      title: "Something went wrong (client)!",
      message: err.message,
    });
  }
  // B) Programming or other unknown error: don't leak error details
  //  1)Log error
  console.log("ERROR", err);
  return res.status(err.statusCode).send("error", {
    title: "Something went wrong!",
    message: "Please try again later",
  });
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    sendDevError(err, req, res);
  } else if (process.env.NODE_ENV == "production") {
    let error = { ...err };
    error.message = err.message;
    if (error.name === "ValidationError") error = handleValidationError(error);
    // Duplicated unique fields
    if (error.code === 11000) error = handleDuplicatedFieldsDB(error);
    sendProdError(error, req, res);
  }
};
