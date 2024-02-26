const Review = require('./../models/reviewModel');
const catchAsync = require('./../utils/catchAsync');

exports.createReview = catchAsync(async (req, res, next) => {
  if (!req.body.tour) req.body.tour = req.params.tourId;
  if (!req.body.user) req.body.user = req.user.id;

  const newReview = await Review.create(req.body);
  res.status(201).json({
    status: 'success',
    data: {
      review: newReview,
    },
  });
});

exports.getAllReviews = catchAsync(async (req, res, next) => {
  const reviews = await Review.find();
  res.status(200).json({
    status: 'success',
    data: {
      reviews,
    },
  });
});

exports.getAReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id).populate('reviews');
  res.status(200).json({
    status: 'success',
    data: {
      review,
    },
  });
});
