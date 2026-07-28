import { Router } from 'express';
import riderRoutes from './rider.routes.js';


const router = Router();

router.use('/riders', riderRoutes);


export default router;