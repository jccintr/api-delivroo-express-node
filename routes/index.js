import { Router } from 'express';
import riderRoutes from './rider.routes.js';
import adminRoutes from './admin.routes.js';
import storeRoutes from './store.routes.js';


const router = Router();

router.use('/riders', riderRoutes);
router.use('/admin', adminRoutes);
router.use('/stores', storeRoutes);


export default router;