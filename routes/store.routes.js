import { Router } from 'express';
import * as StoreController from '../controllers/store.controller.js';
import * as DeliveryController from '../controllers/delivery.controller.js';
import * as CreditController from '../controllers/credit.controller.js';
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
import { receiptUploadMiddleware } from '../middlewares/upload.receipt.js';
import {
    createRechargeOrderValidator,
    rechargeOrderIdValidator,
    informPaymentValidator,
    pageQueryValidator,
} from '../validators/credit.validator.js';


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

// Pacotes de entregas pré-pagos (Pix)
router.get('/credits', AuthStore, CreditController.getCredits);
router.get('/credits/packages', AuthStore, CreditController.listPackages);
router.get('/credits/transactions', AuthStore, pageQueryValidator, validate, CreditController.listTransactions);
router.post('/credits/orders', AuthStore, createRechargeOrderValidator, validate, CreditController.createRechargeOrder);
router.get('/credits/orders', AuthStore, pageQueryValidator, validate, CreditController.listRechargeOrders);
router.get('/credits/orders/:id', AuthStore, rechargeOrderIdValidator, validate, CreditController.getRechargeOrder);
router.post('/credits/orders/:id/inform', AuthStore, receiptUploadMiddleware, informPaymentValidator, validate, CreditController.informPayment);
router.post('/credits/orders/:id/cancel', AuthStore, rechargeOrderIdValidator, validate, CreditController.cancelRechargeOrder);

export default router;