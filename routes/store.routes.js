
import { Router } from 'express';
import * as StoreController from '../controllers/store.controller.js';
import AuthStore from '../middlewares/auth.store.js';
import {validate} from '../middlewares/validate.js'
import { loginValidator } from '../validators/rider.validator.js';
import {registerStoreValidator} from '../validators/store.validator.js'


const router = Router();

router.post('/register', registerStoreValidator, validate, StoreController.register);
//router.post('/login', loginValidator, validate, RiderController.login);
//router.get('/me', AuthRider, RiderController.validateToken);

export default router;