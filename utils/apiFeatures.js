class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }
  filter() {
    // Taking the copy of the original req.query so we can do some filtering on the copied query
    const queryObj = { ...this.queryString };
    // Excluding some fields that cannot be directly implemented needs some special handling that will be done in their seperate functions
    const excludedFields = ['page', 'sort', 'limit', 'fields'];

    //   delete will delete the field that matches the fields from above queryObj that is urlParamsQueryString object in
    excludedFields.forEach((el) => delete queryObj[el]);

    //   1B) ADVANCE FILTERING
    let queryStr = JSON.stringify(queryObj);
    // In queryString Obj it will be like {duration: {gt: 100}} but to implement filter in mongo it shpuld be {duration: {$gt: 100}}
    // Making this '$' availble before any queries like $gt, $lt, $gte, $lte by matching with regex and replacing gt -> $gt
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);
    // Tour.find() will finf all the tours out of DB and then again applying .find(JSON.pasrse(queryString)), queryString: {duration: {$gt:100}
    this.query = this.query.find(JSON.parse(queryStr));
    // Untill and unless we do not await the query it will be a query and not the resolved query so we can apply as many mongo query methods on it as we want

    // Need to return the global obj from here {query: _, queryString: _}

    // consoleing 'this' gives:
    // APIFeatures {
    //   query: Query {
    //     _mongooseOptions: {},
    //     mongooseCollection: NativeCollection {
    //       collection: [Collection],
    //       Promise: [Function: Promise],
    //       modelName: 'Tour',
    //     },
    //     model: Model { Tour },
    //     schema: Schema {
    //       obj: [Object],
    //       paths: [Object],
    //       aliases: {}
    //     },
    //     op: 'find',
    //     options: {},
    //     _conditions: {},
    //     _fields: undefined,
    //     _update: undefined,
    //     _path: undefined,
    //     _distinct: undefined,
    //     _collection: NodeCollection {
    //       collection: [NativeCollection],
    //       collectionName: 'tours'
    //     },
    //     _traceFunction: undefined,
    //     '$useProjection': true
    //   },
    //   queryString: {}
    // }
    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }

    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const limitBy = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(limitBy);
    } else {
      this.query = this.query.select('-__v');
    }

    return this;
  }

  paginate() {
    const page = this.queryString.page * 1;
    const limit = this.queryString.limit * 1 || 10;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    return this;
  }
}

module.exports = APIFeatures;
