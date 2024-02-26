const AppError = require('./../utils/appError');

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsErrorDB = (err) => {
  const val = err.errmsg.match(/"(.*?)"/)[0];
  const message = `Duplicate field value: ${val}. Please use another value! `;

  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  // err.errors is an object
  // To loop over object we use Object.values() which will convert it into an array
  // Object.values(err.errors)
  const errors = Object.values(err.errors).map((val) => val.message);
  const message = `Invalid input data: ${errors.join('. ')}`;

  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError('Invalid Token, Please login again!', 401);

const handleJWTExpiredError = () =>
  new AppError('Token Expired, Please login again!', 401);

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err, res) => {
  // Operational Trusted Error Message from the App Itself and not the third party Libraries then send to client the direct MSG
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // 1) Log to console
    console.error(err.message);

    // 2) Send a generic message to the client if error occurs from the third party library
    // Now mongoose errors will also include into this so we will handle that separately
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong!',
    });
  }
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = err;
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsErrorDB(error);
    if (error.name === 'ValidationError')
      error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
  next();
};
