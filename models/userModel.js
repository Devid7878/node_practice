const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'A user must have a name'],
    // validate: [validator.isAlpha, 'user name must only contain characters']
  },
  email: {
    type: String,
    required: [true, 'A user must have a email'],
    unique: true,
    trim: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please enter a valid email!'],
  },
  photo: String,
  role: {
    type: String,
    default: 'user',
    enum: ['user', 'guide', 'lead-guide', 'admin'],
  },
  password: {
    type: String,
    required: [true, 'Please enter a password!'],
    select: false,
    minlength: [6, 'A password must have more or equal then 6 characters'],
    // validate: [validator.isAlpha, 'user name must only contain characters']
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm a password!'],
    validate: {
      validator: function (val) {
        return val === this.password;
      },
      message: 'Passwords do not match!',
    },
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
});

userSchema.pre('save', async function (next) {
  // If the passoword is not modified then just return immediately
  if (!this.isModified('password')) return next();

  // This will run whenever a new user is created
  this.password = await bcrypt.hash(this.password, 12);
  // Not saving passwordConfirm to the DB as it is not needed after the validation is complete
  this.passwordConfirm = undefined;
  next();
});

userSchema.pre('save', function (next) {
  // If the password is not modified or the doc is created a new one then just return immediately
  if (!this.isModified('password') || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000; // Add 1000ms to this prop because sometimes the jwt will sign a new token
  //    before saving this field to the DB and so we need to reduce just a sec from passwordChangedAt field because we are comapring the token expiration time with
  // passwordCreatedAt field and so if jwt token is signed before so the jwtXreatedTime < passwordChangedAt field so user will always get the expired token error
  next();
});

userSchema.pre(/^find/, function (next) {
  // As this is a query middleware 'this' points to the current query

  //   This middleware will run before any query that hits find()/findByIdAndDelete()/...
  this.find({ active: { $ne: 'false' } }); //show the docs only that are having active : true
  next();
});

// This is the instance method that will be availble on every doc
userSchema.methods.checkPassword = async function (
  candidatePassword, //user entered password
  userPassword // this is the saved password in DB while signing up
) {
  // Generally we do not need the second argument we can do this.password whcih refers password of the current doc but we have make select: false
  // so password will not be available on the document for that reason we need to pass the password from the user
  return await bcrypt.compare(candidatePassword, userPassword);
  //   Returns true/false
};

userSchema.methods.changedPasswordAfterTokenGenerated = async function (
  jwtCreatedAt
) {
  // DB have a property called passwordChangedAt that will have a date when the password will be changed
  // Compare the token date and the passwordChangedDate if the jwtDate < changedDate it returns true and so that
  //the password was changed after the token was issued and so we need to show error that the password was changed login again with the changed password

  if (this.passwordChangedAt) {
    const passwordChangedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );

    return jwtCreatedAt < passwordChangedTimestamp;
  }

  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
