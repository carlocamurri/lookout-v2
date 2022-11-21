import { JobFilter, JobGroup, JobOrder } from "model"

export default interface GroupJobsService {
  groupJobs(
    filters: JobFilter[],
    order: JobOrder,
    groupedField: string,
    aggregates: string[],
    skip: number,
    take: number,
    signal: AbortSignal | undefined,
  ): Promise<GroupJobsResponse>
}

export type GroupJobsResponse = {
  totalGroups: number
  groups: JobGroup[]
}
