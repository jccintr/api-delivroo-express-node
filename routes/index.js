import { Router } from 'express';
import riderRoutes from './rider.routes.js';
import adminRoutes from './admin.routes.js';


const router = Router();

router.use('/riders', riderRoutes);
router.use('/admin', adminRoutes);


export default router;