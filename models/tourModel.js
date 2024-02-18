const mongoose = require('mongoose');
const slugify = require('slugify');

const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'],
      unique: true,
      trim: true,
      maxlength: [40, 'A tour name must have less or equal then 40 characters'],
      minlength: [10, 'A tour name must have more or equal then 10 characters'],
      // validate: [validator.isAlpha, 'Tour name must only contain characters']
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size'],
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'],
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either: easy, medium, difficult',
      },
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price'],
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function (val) {
          // this only points to current doc on NEW document creation
          return val < this.price;
        },
        message: 'Discount price ({VALUE}) should be below regular price',
      },
    },
    summary: {
      type: String,
      trim: true,
      required: [true, 'A tour must have a description'],
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image'],
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false,
    },
    startDates: [Date],
    secretTour: {
      type: Boolean,
      default: false,
    },
  },
  {
    toJSON: { virtuals: true },
    // toObject: { virtuals: true },
  }
);

// virtual is a feture used to calculate somwthing based on some property that is defined in Schema like no of weeks from no of days b/c it is not good thing to store no of days and no of weeks both into the DB so we virtually get no of weeks by calculating duration/7
tourSchema.virtual('durationWeeks').get(function () {
  return this.duration / 7; //this refers to the current doc
  // regular fxn is used to get the access of the this keyword as t is not accessible on arrow fxns
});

// 1) DOCUMENT MIDDLEWARE I.E. PRE() AND POST() MODDLEWARE WHCIH GETS EXECUTED BEFORE AND AFTER THE DOC GETS SAVED TO THE DB RESPECTIVELY. AND IT WILL BE EXECUTED ONLY FOR THE .SAVE() AND .CREATE() DB methods

tourSchema.pre('save', function (next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

// tourSchema.pre('save', function (next) {
//   console.log('The 2nd Pre Middleware!');
//   next();
// });

// tourSchema.post('save', function (doc, next) {
//   // has access to the current doc that got saved
//   console.log(doc);
//   next();
// });

// 2) QUERY MIDDLEWARE IT RUNS ON FIND(), FINDONE(), FINDBYIDANDUPDATE() AND SO ON.
// IT HAS SIMILAR TWO FXNS PRE() AND POST() PRE() WILL RUN JUST BEFORE THE QUERY RUNS HERE QUERY RUNS MEANS THE FIND() / FINDONE() / ... FXN GETS EXECUTED BECAUSE ALL THSI FXN RETURNS A QUERY NOT A DOC

tourSchema.pre(/^find/, function (next) {
  this.find({ secretTour: { $ne: 'true' } }); //query that finds secretTour not equals to true and returns that docs only it will not show tour that has prop secretTour: true
  this.start = Date.now();
  next();
});

tourSchema.post(/^find/, function (docs, next) {
  console.log(
    `Time taken by the query to execute:  ${Date.now() - this.start} ms`
  );
  console.log(docs);
  next();
});

// 3) AGGREGATE MIDDLEWARE THIS MIDDLEWARE EXECUTES BEFORE AND AFTER THE AGREGATATION PIELINE FILTER OUT THE TOURS THAT ARE SECRETTOUR BECAUSE WE NEVER RUN ANY MIDDLEWARE FOR THAT AGGREGATION PIPELINE SO FOR THAT WE NEED TO USE IT

// BECAUSE THE CONTROLLER USING AGGREGATION PIPELINNE WILL NOT

// THIS MIDDLEWARE IS NEEDED IF WE WANT TO ADD ANY AGGREGATION QUERIES BEFORE THE AGGREGATATION PIPELINE THAT WE DID IN OUR CONTROLLER LIKE NEEDS TO ADD SOMETHING THAT MUST BE IN ALL AGREGATORS THEN INSTEAD OF ADDING IN EVERY AGGREGATOR PIPELINE WE CAN USE AGGREGATE MIDDLEWARE
tourSchema.pre('aggregate', function (next) {
  this.pipeline().unshift({ $match: { secretTour: { $ne: 'true' } } });
  // unshift will add something at the start of the array and shift will add items at the end of the array.
  // console.log(this.pipeline());

  next();
});

const Tour = mongoose.model('Tour', tourSchema);
module.exports = Tour;
