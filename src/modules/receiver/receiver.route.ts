import { Router } from 'express';
import handleRecordFormate1 from './controllers/handleRecordFormate1.js';

const router = Router();

router.route('/format/1')
  .post(handleRecordFormate1);

export default router;
