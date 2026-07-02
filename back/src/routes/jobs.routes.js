import { Router } from 'express';
import { createJob, deleteJob, getJobs } from '../controllers/jobs.controller.js';
const router = Router();
router.get('/', getJobs);
router.post('/', createJob);
router.delete('/:id', deleteJob);
export default router;
//# sourceMappingURL=jobs.routes.js.map