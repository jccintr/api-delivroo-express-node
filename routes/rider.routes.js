
import { Router } from 'express';
import * as RiderController from '../controllers/rider.controller.js';
import * as DeliveryController from '../controllers/delivery.controller.js';
import AuthRider from '../middlewares/auth.rider.js';
import {validate} from '../middlewares/validate.js'
import { registerValidator, loginValidator,accountVerificationValidator,resetPasswordValidator,updateProfileValidator,updateVehicleValidator } from '../validators/rider.validator.js';
import { deliveryReasonValidator, historyQueryValidator } from '../validators/delivery.validator.js';
import { uploadAvatar as uploadMiddleware } from '../middlewares/upload.avatar.js';

const router = Router();

router.post('/register', registerValidator, validate, RiderController.register);
router.post('/login', loginValidator, validate, RiderController.login);
router.post('/verify-account/resend',AuthRider,RiderController.resendAccountVerificationCode);
router.post('/verify-account',AuthRider, accountVerificationValidator, validate,RiderController.verifyAccount);
router.post('/password/request',RiderController.requestPasswordCode);
router.post('/password/verify-code',RiderController.verifyPasswordCode);
router.post('/password/reset',resetPasswordValidator, validate, RiderController.resetPassword);
router.get('/me', AuthRider, RiderController.validateToken);
router.patch('/me',AuthRider,updateProfileValidator,validate,RiderController.updateProfile);
router.patch('/me/avatar', AuthRider,uploadMiddleware.single('avatar'),RiderController.uploadAvatar);
router.patch('/me/document', AuthRider,uploadMiddleware.single('document'),RiderController.uploadDocument);
router.patch('/me/status', AuthRider,RiderController.toggleOnlineStatus);
router.patch('/me/vehicle',AuthRider,updateVehicleValidator, validate,RiderController.updateVehicle);
router.get('/deliveries/available', AuthRider, DeliveryController.listAvailableDeliveries);
router.get('/deliveries/active', AuthRider, DeliveryController.listActiveDeliveries);
router.get('/deliveries/history', AuthRider, historyQueryValidator, validate, DeliveryController.listRiderDeliveryHistory);
router.get('/deliveries/:id', AuthRider, DeliveryController.getDelivery);
router.post('/deliveries/:id/accept', AuthRider, DeliveryController.acceptDelivery);
router.post('/deliveries/:id/pickup', AuthRider, DeliveryController.pickupDelivery);
router.post('/deliveries/:id/en-route', AuthRider, DeliveryController.dispatchDelivery);
router.post('/deliveries/:id/deliver', AuthRider, DeliveryController.deliverDelivery);
router.post('/deliveries/:id/return', AuthRider, deliveryReasonValidator, validate, DeliveryController.returnDelivery);
router.post('/deliveries/:id/cancel', AuthRider, deliveryReasonValidator, validate, DeliveryController.cancelDeliveryByRider);

export default router;