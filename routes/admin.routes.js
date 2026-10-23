import { Router } from 'express';
import * as AdminController from '../controllers/admin.controller.js';
import * as AdminCreditController from '../controllers/admin.credit.controller.js';
import AuthAdmin from '../middlewares/auth.admin.js';
import {validate} from '../middlewares/validate.js'
import { registerValidator, loginValidator, createCityValidator, listRidersValidator, listStoresValidator, listDeliveriesValidator, updatePlatformSettingsValidator } from '../validators/admin.validator.js';

import {
  createPackageValidator,
  updatePackageValidator,
  packageIdValidator,
  listRechargeOrdersValidator,
  rejectRechargeOrderValidator,
  adjustCreditsValidator,
  rechargeOrderIdValidator,
} from '../validators/credit.validator.js';

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
router.get('/platform-settings', AuthAdmin, AdminController.getPlatformSettings);
router.patch('/platform-settings', AuthAdmin, updatePlatformSettingsValidator, validate, AdminController.updatePlatformSettings);

// Pacotes de entregas (criar, editar, habilitar/desabilitar, excluir)
router.get('/credit-packages', AuthAdmin, AdminCreditController.listPackages);
router.post('/credit-packages', AuthAdmin, createPackageValidator, validate, AdminCreditController.createPackage);
router.patch('/credit-packages/:id', AuthAdmin, updatePackageValidator, validate, AdminCreditController.updatePackage);
router.delete('/credit-packages/:id', AuthAdmin, packageIdValidator, validate, AdminCreditController.deletePackage);

// Recargas (pedidos de compra de pacote pagos via Pix)
router.get('/recharge-orders/summary', AuthAdmin, AdminCreditController.getRechargeSummary);
router.get('/recharge-orders', AuthAdmin, listRechargeOrdersValidator, validate, AdminCreditController.listRechargeOrders);
router.get('/recharge-orders/:id', AuthAdmin, rechargeOrderIdValidator, validate, AdminCreditController.getRechargeOrder);
router.post('/recharge-orders/:id/confirm', AuthAdmin, rechargeOrderIdValidator, validate, AdminCreditController.confirmRechargeOrder);
router.post('/recharge-orders/:id/reject', AuthAdmin, rejectRechargeOrderValidator, validate, AdminCreditController.rejectRechargeOrder);

// Saldo de entregas por loja
router.get('/stores/:id/credits', AuthAdmin, rechargeOrderIdValidator, validate, AdminCreditController.getStoreCredits);
router.post('/stores/:id/credits', AuthAdmin, adjustCreditsValidator, validate, AdminCreditController.adjustStoreCredits);

export default router;