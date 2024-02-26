const express = require('express');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');

const router = express.Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword/:token', authController.resetPassword);
router.patch(
  '/updateMyPassword',
  authController.protect,
  authController.updateMyPassword
);

router.patch('/updateMe', authController.protect, userController.updateMe);
router
  .route('/')
  .get(userController.getAllUsers)
  .delete(userController.deleteUser);

router.delete('/deleteMe', authController.protect, userController.deleteMe);
router
  .route('/')
  .get(userController.getAllUsers)
  .delete(userController.deleteUser);

module.exports = router;
