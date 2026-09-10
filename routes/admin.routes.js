
import { Router } from 'express';
import * as AdminController from '../controllers/admin.controller.js';
import AuthAdmin from '../middlewares/auth.admin.js';
import {validate} from '../middlewares/validate.js'
import { registerValidator, loginValidator, createCityValidator, listRidersValidator, listStoresValidator, listDeliveriesValidator } from '../validators/admin.validator.js';

const router = Router();

router.post('/register', registerValidator, validate, AdminController.register);
router.post('/login', loginValidator, validate, AdminController.login);
router.get('/me', AuthAdmin, AdminController.validateToken);
router.post('/create', AuthAdmin,registerValidator, validate, AdminController.register);
router.get('/dashboard', AuthAdmin, AdminController.getDashboardStats);
router.get('/riders', AuthAdmin, listRidersValidator, validate, AdminController.listRiders);
router.get('/riders/:id', AuthAdmin, AdminController.getRider);
router.patch('/riders/:id/approve', AuthAdmin, AdminController.approveRider);
router.patch('/riders/:id/active', AuthAdmin, AdminController.setRiderActive);
router.get('/stores', AuthAdmin, listStoresValidator, validate, AdminController.listStores);
router.get('/stores/:id', AuthAdmin, AdminController.getStore);
router.patch('/stores/:id/active', AuthAdmin, AdminController.setStoreActive);
router.get('/deliveries', AuthAdmin, listDeliveriesValidator, validate, AdminController.listDeliveries);
router.get('/cities', AuthAdmin, AdminController.listCities);
router.post('/cities', AuthAdmin,createCityValidator, validate, AdminController.createCity);

export default router;