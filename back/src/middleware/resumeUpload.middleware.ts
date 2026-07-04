import type { RequestHandler } from 'express'
import multer from 'multer'

const MAX_RESUME_SIZE = 5 * 1024 * 1024

const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_RESUME_SIZE,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== 'application/pdf') {
      callback(new Error('resume must be a PDF file'))
      return
    }

    callback(null, true)
  },
}).single('resume')

export const handleResumeUpload: RequestHandler = (req, res, next) => {
  resumeUpload(req, res, (error) => {
    if (!error) {
      next()
      return
    }

    if (
      error instanceof multer.MulterError &&
      error.code === 'LIMIT_FILE_SIZE'
    ) {
      res.status(400).json({
        message: 'resume PDF must be 5 MB or smaller',
      })
      return
    }

    res.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : 'failed to upload resume',
    })
  })
}
