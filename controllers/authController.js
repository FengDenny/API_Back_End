const User = require("./../models/userModel.js");
const catchAsync = require("./../utility/catchAsync");
const AppError = require("./../utility/appError");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Email = require("./../utility/email");
const { promisfy } = require("util");

// jwt token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      // 24(hour) * 60(min) * 60(second) * 1000(milliseconds)
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpsOnly: true,
  };

  if (process.env.NODE_ENV === "production") cookieOptions.secure = true;
  res.cookie("jwt", token, cookieOptions);
  //   remove the password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user,
    },
  });
};

// Signup
exports.signup = catchAsync(async (req, res, next) => {
  const { firstName, lastName, email, password, passwordConfirm } = req.body;
  const newUser = await User.create({
    firstName,
    lastName,
    email,
    password,
    passwordConfirm,
  });
  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new AppError("Please provide a email and a password", 400));
  }
  //   check if user exist and password is correct
  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Incorrect email or password", 401));
  }
  //   if everything is good, send token to client
  createSendToken(user, 200, res);
});

// Forgot password
exports.forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  // get users email
  const user = await User.findOne({ email });

  if (!user) {
    return next(
      new AppError(
        `There is no user associated with ${email}. Please sign up! `,
        404
      )
    );
  }
  // Generate a random token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  try {
    // 3) send it to user's email address
    const resetURL = `${req.protocol}://${req.get(
      "host"
    )}/api/v1/users/resetPassword/${resetToken}`;

    await new Email(user, resetURL, resetToken).sendPasswordReset();
    res.status(200).json({
      status: "success",
      message: `We have sent an email to ${email} to reset your password`,
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new AppError("There was an error sending the email!", 500));
  }
});

// Password reset

exports.resetPassword = catchAsync(async (req, res, next) => {
  // To check a password between 6 to 20 characters which contain at least one numeric digit, one uppercase and one lowercase letter
  const passReq = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,20}$/;

  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new AppError("Token is invalid or has expired!", 400));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  if (user.password.match(passReq) && user.passwordConfirm.match(passReq)) {
    await user.save();

    //  Update changedPasswordAt property for the user
    // log user in and sent JWT
    createSendToken(user, 200, res);
  } else {
    return next(new AppError("Invalid password format", 400));
  }
});

// protected route
exports.protect = catchAsync(async (req, res, next) => {
  // Get token and check if its available
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    // Bearer(0) the token(1)
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(
      new AppError("You are not logged in! Please log in to gain access.", 401)
    );
  }

  //   Verification token
  const decoded = await promisfy(jwt.verify)(token, process.env.JWT_SECRET);

  //   Check if user still exist
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        "The user belonging to this token does no longer exist,",
        401
      )
    );
  }
  //  check if user changed password after the token was issued

  if (currentUser.changePasswordAfter(decoded.iat)) {
    return next(
      new AppError("User recently changed password! Please log in again!", 401)
    );
  }
});
