const { promisify } = require('util');
const catchAsync = require('./../utils/catchAsync');
const User = require('./../models/userModel');
const jwt = require('jsonwebtoken');
const AppError = require('../utils/appError');
const crypto = require('crypto');
const sendEmail = require('../utils/email');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true, // For preventing cross browsing scripting attacks
    secure: process.env.NODE_ENV === 'production' ? 'true' : 'false',
  };
  res.cookie('jwt', token, cookieOptions);

  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
  });

  //   while signing up the user will be logged in as the user signs up no need to verify
  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Please provide password and email!', 400));
  }

  //   .select('+password) is done because we have select: false to password field in model so it will not be visible in the output
  const user = await User.findOne({ email }).select('+password');

  //   Here the user is a doc fetched by querying findOne() so instance methods will be availble on user doc

  // checkPassword(userEnteredPassword, dbSavedPassWhileSignup)
  if (!user || !(await user.checkPassword(password, user.password))) {
    return next(new AppError('Invalid credentials!', 401));
  }

  // Then simply sign a new jwt token and send a success res with a newly signed token
  createSendToken(user, 200, res);
});

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting user and checking if token is present
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) next(new AppError('Please login to access this route!', 401));

  // 2) Verifying Token
  //   Make it a promise and then await just because verify is a sync task and it can stop out event loop processing further can slow down our server
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Cheking if user still exists
  //   Here if someone stole the token and user is actually deleted and someone tries to access with that token then that needs to be prevented
  const currUser = await User.findById(decoded.id);

  if (!currUser)
    next(
      new AppError('The user belonging to this token no longer exist!', 401)
    );
  // 4) Checking if user has not changed a password after token is generated
  if (await currUser.changedPasswordAfterTokenGenerated(decoded.iat)) {
    return next(
      new AppError(
        'Your password has changed since you last logged in! Please login again.',
        401
      )
    );
  }

  req.user = currUser;
  next();
});

exports.restrictTo = (...roles) => {
  // creating a wrapper function beacuse in middleware fxn we cannot pass in the arguments other than req, res, & next so we need another function as a wrapper
  //   that will return a middleware
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You are not authorized to access this route!', 403)
      );
    }
    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // Get user based on posted email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('No user with that email!', 404));
  }
  // Generate the random reset token and it is not a jwt token its a random token
  const resetToken = user.createPasswordResetToken();

  //The above fxn will only modify the fields but we need to save it to DB also
  await user.save({ validateBeforeSave: false });

  //   send an email to the user
  const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/users/resetPassword/${resetToken}`;

  const message = `You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\n
  Please click on the following link, or paste this into your browser to complete the process:\n\n
  ${resetURL}\n\n
  If you did not request this, please ignore this email and your password will remain unchanged.\n`;

  await sendEmail({
    email: user.email,
    subject: 'Password Reset Request(valid for upto 10 mins)!',
    message,
  });

  res.status(200).json({
    status: 'success',
    message: `An email has been sent to ${user.email} with further instructions!`,
  });
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get the user from the DB using token passed in the resetURL as a params

  // In params the token will not be the hashed token it will be just the randomly generated token
  // But in DB the saved passwordResetToken will be a hashed token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }, // filter based on expiry of token as well like if the resetPassword token was generated 10 min before  this the
  });

  // 2) If the user found then set the nre password
  if (!user) return next(new AppError('Token is invalid or has expired!', 400));

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;

  //   Make the passwordResetToken and passwordResetExpires be deleted at this time as rest of password is done it will be added whenever the user routes on forgetPassword
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  //   Added a new field in DB with passwordChangedAt using .pre() middleware in model

  //   we are using save() and not update() because we need to run those middlewares that we created in model and so we need to use save() only!
  await user.save();

  //   Sign a new token on reseting
  createSendToken(user, 200, res);
});

exports.updateMyPassword = catchAsync(async (req, res, next) => {
  // 1) Get the user
  const user = await User.findById(req.user.id).select('+password');

  if (!user) return next(new AppError('User not found!', 404));

  // 2) Check the POSTed password if it is correct

  if (!(await user.checkPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Invalid credentials!', 401));
  }

  //  3) If so update the password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  // Again we cannot use findBuIdAndUpdate() b/c our middleware fxn and validator in model will not run
  await user.save();

  // 4) Sign a new token on updatePassword
  createSendToken(user, 200, res);
});
