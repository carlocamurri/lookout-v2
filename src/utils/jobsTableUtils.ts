import { ExpandedState, Table, Updater } from "@tanstack/react-table"
import _ from "lodash"
import { Job, JobFilter, JobGroup, JobOrder } from "model"
import { JobRow, JobGroupRow, JobTableRow } from "models/jobsTableModels"
import GetJobsService from "services/GetJobsService"
import GroupJobsService from "services/GroupJobsService"
import { RowIdParts, toRowId, RowId } from "./reactTableUtils"

export const convertExpandedRowFieldsToFilters = (expandedRowIdParts: RowIdParts[]): JobFilter[] => {
  const filters: JobFilter[] = expandedRowIdParts.map(({ type, value }) => ({
    field: type,
    value,
    match: "exact",
  }))

  return filters
}

export interface FetchRowRequest {
  filters: JobFilter[]
  skip: number
  take: number
}
export const fetchJobs = async (rowRequest: FetchRowRequest, getJobsService: GetJobsService) => {
  const { filters, skip, take } = rowRequest

  const order: JobOrder = { field: "jobId", direction: "ASC" }
  return await getJobsService.getJobs(filters, order, skip, take, undefined)
}

export const fetchJobGroups = async (
  rowRequest: FetchRowRequest,
  groupJobsService: GroupJobsService,
  groupedColumn: string,
  columnsToAggregate: string[],
) => {
  const { filters, skip, take } = rowRequest

  const order: JobOrder = { field: "name", direction: "ASC" }
  return await groupJobsService.groupJobs(filters, order, groupedColumn, columnsToAggregate, skip, take, undefined)
}

export const jobsToRows = (jobs: Job[]): JobRow[] => {
  return jobs.map(
    (job): JobRow => ({
      rowId: toRowId({ type: "job", value: job.jobId }),
      jobId: job.jobId,
      jobSet: job.jobSet,
      queue: job.queue,
      state: job.state,
      cpu: job.cpu,
      memory: job.memory,
      ephemeralStorage: job.ephemeralStorage,
    }),
  )
}

export const groupsToRows = (
  groups: JobGroup[],
  baseRowId: RowId | undefined,
  groupingField: string,
): JobGroupRow[] => {
  return groups.map(
    (group): JobGroupRow => ({
      rowId: toRowId({ type: groupingField, value: group.name, parentRowId: baseRowId }),
      [groupingField]: group.name,

      isGroup: true,
      count: group.count,
      subRows: [], // Will be set later if expanded
    }),
  )
}

export const diffOfKeys = <K extends string | number | symbol>(
  currentObject?: Record<K, unknown>,
  oldObject?: Record<K, unknown>,
): [K[], K[]] => {
  const currentKeys = new Set(Object.keys(currentObject ?? {}) as K[])
  const prevKeys = new Set(Object.keys(oldObject ?? {}) as K[])

  const addedKeys = Array.from(currentKeys).filter((e) => !prevKeys.has(e))
  const removedKeys = Array.from(prevKeys).filter((e) => !currentKeys.has(e))
  return [addedKeys, removedKeys]
}

export const normaliseExpandedState = (
  updaterOrValue: Updater<ExpandedState>,
  currentState: ExpandedState,
  table: Table<JobTableRow>,
) => {
  const newValue = typeof updaterOrValue === "function" ? updaterOrValue(currentState) : updaterOrValue
  if (typeof newValue === "boolean") {
    const allRowsExpanded = _.fromPairs(table.getRowModel().flatRows.map((r) => [r.id, true]))
    return allRowsExpanded
  } else {
    return newValue
  }
}
