import { Job, JobFilter, JobOrder } from "model"

export interface GetJobsService {
  getJobs(
    filters: JobFilter[],
    order: JobOrder,
    skip: number,
    take: number,
    signal: AbortSignal | undefined,
  ): Promise<Job[]>
}
