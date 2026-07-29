
import { Router } from 'express';
import * as AdminController from '../controllers/admin.controller.js';
import AuthAdmin from '../middlewares/auth-admin.js';
import {validate} from '../middlewares/validate.js'
import { registerValidator, loginValidator } from '../validators/admin.validator.js';

const router = Router();

router.post('/register', registerValidator, validate, AdminController.register);
router.post('/login', loginValidator, validate, AdminController.login);
router.get('/me', AuthAdmin, AdminController.validateToken);
router.post('/create', AuthAdmin,registerValidator, validate, AdminController.register);

export default router;