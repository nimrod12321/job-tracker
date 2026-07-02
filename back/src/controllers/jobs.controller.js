import { randomUUID } from 'node:crypto';
const jobs = [
    {
        id: '1',
        company: 'MongoDB',
        position: 'Technical Services Engineer',
        status: 'applied',
        wantedSalary: 20000,
        location: 'Tel Aviv',
        notes: 'Backend fake data from Express server.',
        createdAt: '2026-07-01',
        updatedAt: '2026-07-01',
    },
];
const validStatuses = [
    'applied',
    'HR',
    'technical',
    'rejected',
    'offer',
];
export function getJobs(req, res) {
    res.json(jobs);
}
export function createJob(req, res) {
    const { company, position, status, wantedSalary, location, notes } = req.body;
    if (!company || !position || !location) {
        return res.status(400).json({
            message: 'company, position, and location are required',
        });
    }
    if (status && !validStatuses.includes(status)) {
        return res.status(400).json({
            message: 'invalid job status',
        });
    }
    const today = new Date().toISOString().slice(0, 10);
    const newJob = {
        id: randomUUID(),
        company,
        position,
        status: status ?? 'applied',
        wantedSalary: Number(wantedSalary) || 0,
        location,
        notes: notes ?? '',
        createdAt: today,
        updatedAt: today,
    };
    jobs.unshift(newJob);
    return res.status(201).json(newJob);
}
export function deleteJob(req, res) {
    const { id } = req.params;
    const jobIndex = jobs.findIndex((job) => job.id === id);
    if (jobIndex === -1) {
        return res.status(404).json({
            message: 'job not found',
        });
    }
    jobs.splice(jobIndex, 1);
    return res.status(204).send();
}
export function updateJobStatus(req, res) {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
        return res.status(400).json({
            message: 'status is required',
        });
    }
    if (!validStatuses.includes(status)) {
        return res.status(400).json({
            message: 'invalid job status',
        });
    }
    const job = jobs.find((job) => job.id === id);
    if (!job) {
        return res.status(404).json({
            message: 'job not found',
        });
    }
    job.status = status;
    job.updatedAt = new Date().toISOString().slice(0, 10);
    return res.json(job);
}
//# sourceMappingURL=jobs.controller.js.map