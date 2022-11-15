import { Job, JobFilter, JobKey, JobOrder } from "model"
import { compareValues, mergeFilters } from "utils"

import GetJobsService, { GetJobsResponse } from "services/GetJobsService"

export default class FakeGetJobsService implements GetJobsService {
  jobs: Job[]

  constructor(jobs: Job[]) {
    this.jobs = jobs
  }

  getJobs(
    filters: JobFilter[],
    order: JobOrder,
    skip: number,
    take: number,
    signal: AbortSignal | undefined,
  ): Promise<GetJobsResponse> {
    const filtered = this.jobs.filter(mergeFilters(filters)).sort(comparator(order))
    return Promise.resolve({
      totalJobs: filtered.length,
      jobs: filtered.slice(skip, skip + take),
    })
  }
}

function comparator(order: JobOrder): (a: Job, b: Job) => number {
  return (a, b) => {
    const field = order.field as JobKey
    const valueA = a[field]
    const valueB = b[field]

    if (valueA === undefined || valueB === undefined) {
      console.error("comparator values are undefined")
      return 0
    }

    return compareValues(valueA, valueB, order.direction)
  }
}
