import { Router } from 'express';
import withDatabase from '@/core/withDatabase.js';
import { Controller as uploadFile } from '@/modules/file/controllers/uploadFile.js';
import { Controller as uploadMultipleFiles } from '@/modules/file/controllers/uploadMultipleFiles.js';
import env from '@/config/env.js';
import express from 'express';
import fileUpload from '@/middleware/multer/fileUpload.js';
import permission from '@/middleware/auth/permission.js';

const router = Router();

const fileUploadAccess = permission('admin', 'qc');

router.route('/upload')
  .post(fileUploadAccess, fileUpload.single('file'), withDatabase(uploadFile));

router.route('/upload-multiple')
  .post(fileUploadAccess, fileUpload.array('files'), withDatabase(uploadMultipleFiles));

router.use('/', express.static(env.fileStoragePath));

export default router;
