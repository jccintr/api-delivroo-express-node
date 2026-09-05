import { Router } from 'express';
import * as StoreController from '../controllers/store.controller.js';
import * as DeliveryController from '../controllers/delivery.controller.js';
import AuthStore from '../middlewares/auth.store.js';
import {validate} from '../middlewares/validate.js'
import { loginValidator } from '../validators/rider.validator.js';
import {
    registerStoreValidator, 
    accountVerificationValidator,
    resetPasswordValidator,
    updateProfileValidator,
    
} from '../validators/store.validator.js'
import { createDeliveryValidator, deliveryReasonValidator, historyQueryValidator } from '../validators/delivery.validator.js';
import { uploadAvatar as uploadMiddleware } from '../middlewares/upload.avatar.js';


const router = Router();

router.post('/register', registerStoreValidator, validate, StoreController.register);
router.post('/login', loginValidator, validate, StoreController.login);
router.get('/me', AuthStore, StoreController.validateToken);
router.patch('/me', AuthStore, updateProfileValidator, validate, StoreController.updateProfile);
router.patch('/me/avatar', AuthStore,uploadMiddleware.single('avatar'),StoreController.uploadAvatar);
router.post('/verify-account',AuthStore, accountVerificationValidator, validate,StoreController.verifyAccount);
router.post('/verify-account/resend',AuthStore,StoreController.resendAccountVerificationCode);
router.post('/password/request',StoreController.requestPasswordCode);
router.post('/password/verify-code',StoreController.verifyPasswordCode);
router.post('/password/reset',resetPasswordValidator, validate, StoreController.resetPassword);
router.post('/deliveries', AuthStore, createDeliveryValidator, validate, DeliveryController.createDelivery);
router.get('/deliveries/dashboard', AuthStore, DeliveryController.getStoreDashboardStats);
router.get('/deliveries/recent', AuthStore, DeliveryController.listStoreRecentDeliveries);
router.get('/deliveries/active', AuthStore, DeliveryController.listStoreActiveDeliveries);
router.get('/deliveries/history', AuthStore, historyQueryValidator, validate, DeliveryController.listStoreDeliveryHistory);
router.post('/deliveries/:id/cancel', AuthStore, deliveryReasonValidator, validate, DeliveryController.cancelDeliveryByStore);

export default router;