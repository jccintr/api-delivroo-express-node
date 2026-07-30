
import { Router } from 'express';
import * as RiderController from '../controllers/rider.controller.js';
import AuthRider from '../middlewares/auth.rider.js';
import {validate} from '../middlewares/validate.js'
import { registerValidator, loginValidator } from '../validators/rider.validator.js';

const router = Router();

router.post('/register', registerValidator, validate, RiderController.register);
router.post('/login', loginValidator, validate, RiderController.login);
router.get('/me', AuthRider, RiderController.validateToken);

export default router;