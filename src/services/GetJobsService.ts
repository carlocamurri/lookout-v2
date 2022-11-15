import { Job, JobFilter, JobOrder } from "model"

export default interface GetJobsService {
  getJobs(
    filters: JobFilter[],
    order: JobOrder,
    skip: number,
    take: number,
    signal: AbortSignal | undefined,
  ): Promise<GetJobsResponse>
}

export type GetJobsResponse = {
  total: number
  jobs: Job[]
}
