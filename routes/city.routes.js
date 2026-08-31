// routes/city.routes.js  (ou em app.js)
import { Router } from 'express';
import * as CityController from '../controllers/city.controller.js';

const router = Router();

router.get('/', CityController.listActiveCities);

export default router;