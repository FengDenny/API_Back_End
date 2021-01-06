const express = require("express");
const morgan = require("morgan");
const path = require("path");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const AppError = require("./utility/appError");
const globalErrorHandler = require("./controllers/errorController");
const userRouter = require("./routes/userRoutes");

const app = express();

// GLOBAL MIDDLEWARE
// Top-level
// Set security for HTTP headers
app.use(helmet());

// setting up email template engine with express
app.set("view engine", "pug");
app.set("view", path.join(__dirname, "views"));

// Development logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
  console.log("App is now in development mode");
}
if (process.env.NODE_ENV === "production") {
  app.use(morgan("prod"));
  console.log("App is now in production mode");
}

// Limit the request from the same API

const limit = rateLimit({
  max: 100,
  // Minutes * second * milliseconds
  windowMs: 15 * 60 * 1000,
  message: "Too many request from this IP, please try again in 15 minutes ",
});

app.use("/api", limit);

// Body parser
app.use(express.json({ limit: "10kb" }));

// Routes
app.use("/api/v1/users", userRouter);

// route middleware
app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});

// Global Error Handler
app.use(globalErrorHandler);
module.exports = app;
