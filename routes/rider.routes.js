
import { Router } from 'express';
import * as RiderController from '../controllers/rider.controller.js';
import AuthRider from '../middlewares/auth.rider.js';
import {validate} from '../middlewares/validate.js'
import { registerValidator, loginValidator,accountVerificationValidator,resetPasswordValidator } from '../validators/rider.validator.js';
import { uploadAvatar as uploadMiddleware } from '../middlewares/upload.avatar.js';

const router = Router();

router.post('/register', registerValidator, validate, RiderController.register);
router.post('/login', loginValidator, validate, RiderController.login);
router.post('/verify-account/resend',AuthRider,RiderController.resendAccountVerificationCode);
router.post('/verify-account',AuthRider, accountVerificationValidator, validate,RiderController.verifyAccount);
router.post('/password/request',RiderController.requestPasswordCode);
router.post('/password/verify-code',RiderController.verifyPasswordCode);
router.post('/password/reset',resetPasswordValidator, validate, RiderController.resetPassword);
router.patch(
  '/me/avatar',
  AuthRider,
  uploadMiddleware.single('avatar'),
  RiderController.uploadAvatar
);

router.get('/me', AuthRider, RiderController.validateToken);

export default router;

