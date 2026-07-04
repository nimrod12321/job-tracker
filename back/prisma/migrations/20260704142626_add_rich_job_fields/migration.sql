-- CreateEnum
CREATE TYPE "JobPriority" AS ENUM ('low', 'medium', 'high');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "companyUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "dateApplied" TIMESTAMP(3),
ADD COLUMN     "jobDescription" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "jobUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "priority" "JobPriority" NOT NULL DEFAULT 'medium',
ADD COLUMN     "salaryMax" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "salaryMin" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT '';
