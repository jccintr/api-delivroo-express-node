
import { Router } from 'express';
import * as StoreController from '../controllers/store.controller.js';
import AuthStore from '../middlewares/auth.store.js';
import {validate} from '../middlewares/validate.js'
import { loginValidator } from '../validators/rider.validator.js';
import {registerStoreValidator, accountVerificationValidator} from '../validators/store.validator.js'


const router = Router();

router.post('/register', registerStoreValidator, validate, StoreController.register);
router.post('/login', loginValidator, validate, StoreController.login);
router.get('/me', AuthStore, StoreController.validateToken);
router.post('/verify-account',AuthStore, accountVerificationValidator, validate,StoreController.verifyAccount);

export default router;