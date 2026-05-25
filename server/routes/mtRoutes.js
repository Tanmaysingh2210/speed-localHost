import express from 'express';
import { addMtPrice, deleteMtPrice, getAllMtPrice, updateMtPrice } from '../controllers/ratesController/mtPriceController.js';

const router = express.Router();

router.post('/', addMtPrice);
router.get('/', getAllMtPrice);
router.patch('/:id', updateMtPrice);
router.delete('/:id', deleteMtPrice);

export default router;