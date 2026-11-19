import { Router } from 'express';
import withDatabase from '@/core/withDatabase.js';
import requireCustomerAuth from '@/middleware/auth/requireCustomerAuth.js';
import fileUpload from '@/middleware/multer/fileUpload.js';
import { Controller as uploadFile } from '@/modules/file/controllers/uploadFile.js';

const router = Router();

router.use(requireCustomerAuth);

router.post('/upload', fileUpload.single('file'), withDatabase(uploadFile));

export default router;
