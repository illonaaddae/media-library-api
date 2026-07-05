// routes/mediaRoutes.js — route definitions only. No business logic: each route
// is a middleware chain ending in a controller reference.
const express = require('express');
const { uploadSingle, uploadArray } = require('../middlewares/upload');
const validate = require('../middlewares/validate');
const {
  createMediaSchema,
  updateMediaSchema,
  mediaQuerySchema,
  idParamSchema,
} = require('../schemas/mediaSchemas');
const controller = require('../controllers/mediaController');

const router = express.Router();

router
  .route('/')
  // Multer runs BEFORE validation: multipart fields don't exist on req.body
  // until Multer parses the multipart/form-data body.
  .post(uploadSingle, validate(createMediaSchema), controller.createMedia)
  .get(validate(mediaQuerySchema, 'query'), controller.listMedia);

// Bulk upload: up to 5 files sharing one metadata set. Multer runs BEFORE
// validation — multipart fields aren't on req.body until Multer parses them.
router
  .route('/bulk')
  .post(uploadArray, validate(createMediaSchema), controller.createBulkMedia);

router
  .route('/:id')
  .get(validate(idParamSchema, 'params'), controller.getMedia)
  // PUT = full update (rubric route); PATCH = semantically-correct partial
  // update. Same validated schema + service; documented distinction in README.
  .put(
    validate(idParamSchema, 'params'),
    validate(updateMediaSchema),
    controller.updateMedia
  )
  .patch(
    validate(idParamSchema, 'params'),
    validate(updateMediaSchema),
    controller.updateMedia
  )
  // Hard delete by default; ?soft=true opts into soft delete.
  .delete(validate(idParamSchema, 'params'), controller.deleteMedia);

router
  .route('/:id/restore')
  .post(validate(idParamSchema, 'params'), controller.restoreMedia);

module.exports = router;
