const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');

const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');

const app = express();

// 1) MIDDLEWARES
app.use(helmet()); //security purposes

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Limits the no of requests from a IP for preventing DOS, Brute Force attacks
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try after a hour!',
});

app.use('/api', limiter);
app.use(express.json({ limit: '10kb' })); // body-parser reading data from body into req.body

app.use(mongoSanitize()); // mongo queries inserted directly to login will be prevented
app.use(xss()); // cross platform request prevented

// If the qyery parameters are used of same name like /api/tours/sort=duration&sort=price
// Then it will make our app crash attackers try to pollute our mechanism without using hpp
// hpp: http parameter pollution attacks
app.use(
  hpp({
    whitelist: [
      // whitelist means this are allowed to use more than one query of same name
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price',
    ],
  })
);

// used to serve the static files from server also called as server side rendering
app.use(express.static(`${__dirname}/public`));

// Testing middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// 2) Routes
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.all('*', (req, res, next) => {
  // Now if we pass err obj in next() then it will automatically reach to the error handler that has four arguments in it by skipping all the middlewares in between
  next(new AppError(`Can't find the ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
