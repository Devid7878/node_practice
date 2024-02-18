const fs = require('fs');
const Tour = require('../models/tourModel');
const APIFeatures = require('./../utils/apiFeatures');

exports.aliasTopTours = (req, res, next) => {
  req.query.limit = 5;
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingsAverage,duration,summary,difficulty';

  next();
};

exports.getAllTours = async (req, res) => {
  try {
    //  1A)BUILD QUERY
    // // Taking the copy of the original req.query so we can do some filtering on the copied query
    // const queryObj = { ...req.query };
    // const excludedFields = ['page', 'sort', 'limit', 'fields'];

    // //   delete will delete the field that matches the fields from above array in
    // excludedFields.forEach((el) => delete queryObj[el]);

    // //   1B) ADVANCE FILTERING
    // let queryStr = JSON.stringify(queryObj);
    // queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);
    // let query = Tour.find(JSON.parse(queryStr));

    //   2) SORTING
    // if (req.query.sort) {
    //   const sortBy = req.query.sort.split(',').join(' ');
    //   query = query.sort(sortBy);
    // } else {
    //   query = query.sort('-createdAt');
    // }

    //   3) Fields Limiting
    // if (req.query.fields) {
    //   const limitBy = req.query.fields.split(',').join(' ');
    //   query = query.select(limitBy);
    // } else {
    //   query = query.select('-__v');
    // }

    //   4) Pagination
    // const page = req.query.page * 1;
    // const limit = req.query.limit * 1 || 10;
    // const skip = (page - 1) * limit;

    // query = query.skip(skip).limit(limit);

    // 3)EXECUTE QUERY
    // Doing this 'query' because if we rightaway awaits the query then we will not be able to apply the sort() or limit() or anything because the query will be resolved rightway

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
  } catch (err) {
    res.status(404).json({
      status: 'fail',
      message: err.message || err,
    });
  }
};

exports.getTour = async (req, res) => {
  const tour = await Tour.findById(req.params.id);
  try {
    // Tour.findOne({ _id: req.params.id })

    res.status(200).json({
      status: 'success',
      data: {
        tour,
      },
    });
  } catch (err) {
    res.status(404).json({
      status: 'fail',
      message: err,
    });
  }
};

exports.createTour = async (req, res) => {
  try {
    const newTour = await Tour.create(req.body);

    res.status(201).json({
      status: 'success',
      data: {
        tour: newTour,
      },
    });
  } catch (err) {
    res.status(404).json({
      status: 'fail',
      message: err,
    });
  }
};

exports.updateTour = async (req, res) => {
  try {
    const newTour = await Tour.findByIdAndUpdate(req.params.id, req.body);

    res.status(201).json({
      status: 'success',
      data: {
        tour: newTour,
      },
    });
  } catch (err) {
    res.status(404).json({
      status: 'fail',
      message: err,
    });
  }
};

exports.deleteTour = async (req, res) => {
  try {
    await Tour.findByIdAndDelete(req.params.id);

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (err) {
    res.status(404).json({
      status: 'fail',
      message: err,
    });
  }
};

exports.getTourStats = async (req, res) => {
  try {
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
  } catch (err) {
    res.status(404).json({
      status: 'fail',
      message: err,
    });
  }
};

exports.getMonthlyPlan = async (req, res) => {
  try {
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
  } catch (err) {
    res.status(404).json({
      status: 'fail',
      message: err,
    });
  }
};
