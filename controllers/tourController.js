const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const Tour = require('../models/tourModel');
const APIFeatures = require('./../utils/apiFeatures');

exports.aliasTopTours = (req, res, next) => {
  req.query.limit = 5;
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingsAverage,duration,summary,difficulty';

  next();
};

exports.getAllTours = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(Tour.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  //   feature is an obj that returns {query: {}, queryString:{}}
  const tours = await features.query; // This will make all calculations first and then awaits the query

  res.status(200).json({
    status: 'success',
    results: tours.length,
    data: {
      tours,
    },
  });
});

exports.getTour = catchAsync(async (req, res, next) => {
  const tour = await Tour.findById(req.params.id);
  // Tour.findOne({ _id: req.params.id })
  if (!tour) {
    return next(new AppError('No Tour found with that ID!', 404));
  }
  res.status(200).json({
    status: 'success',
    data: {
      tour,
    },
  });
});

exports.createTour = catchAsync(async (req, res, next) => {
  const newTour = await Tour.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      tour: newTour,
    },
  });
});

exports.updateTour = catchAsync(async (req, res, next) => {
  const tour = await Tour.findByIdAndUpdate(req.params.id, req.body);
  if (!tour) {
    return next(new AppError('No Tour found with that ID!', 404));
  }
  res.status(201).json({
    status: 'success',
    data: {
      tour,
    },
  });
});

exports.deleteTour = catchAsync(async (req, res, next) => {
  const tour = await Tour.findByIdAndDelete(req.params.id);
  if (!tour) {
    return next(new AppError('No Tour found with that ID!', 404));
  }
  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.getTourStats = catchAsync(async (req, res, next) => {
  const stats = await Tour.aggregate([
    {
      $match: { ratingsAverage: { $gte: 4.6 } },
    },
    {
      $group: {
        _id: { $toUpper: '$difficulty' },
        numTours: { $sum: 1 },
        numRatings: { $sum: '$ratingsQuantity' },
        avgRatings: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
    {
      $sort: { avgPrice: 1 }, // sort in ascending order
    },
    //   {
    //     $match: { _id: { $ne: 'EASY' } },
    //   },
  ]);

  res.status(200).json({
    status: 'success',
    stats,
  });
});

exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
  const year = req.params.year * 1;
  const plan = await Tour.aggregate([
    { $unwind: '$startDates' }, // $unwind will seperate each startDate with seperate doc so there is an array of 3 startDates which will convert on doc for ex 'The Forest Hiker' into 3 'The Forest Hiker' docs so total there will be 27 docs instead of 9 as each docs before has a array of 3 startDates
    {
      $match: {
        // $match will matches the docs based on the startDates of every docs and for that we first needs each and every startDates to be sepearte with each doc so for that we used $unwind
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      $group: {
        // group will group a doc based on our query here it is based on _id, numTourStarts, tours
        _id: {
          $month: '$startDates', // $month gives the month of the startDates field
        },
        numTourStarts: { $sum: 1 }, // sum will simply works as an accumulator after iterating every doc it adds 1 to it and returns sum at the end
        tours: { $push: '$name' }, // $push will create a array and go on pushing the name that matches
      },
    },
    {
      $addFields: {
        month: '$_id', // addFields will add a new field to the doc
      },
    },
    {
      $project: {
        _id: 0, // project will remove the _id from output
      },
    },
    {
      $limit: 12, // limits the output of the no of docs
    },
  ]);
  res.status(200).json({
    status: 'success',
    plan,
  });
});
