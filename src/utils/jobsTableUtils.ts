import { ColumnFiltersState, Updater } from "@tanstack/react-table"
import _ from "lodash"
import { Job, JobFilter, JobGroup, JobOrder, Match } from "model"
import { JobRow, JobGroupRow } from "models/jobsTableModels"
import GetJobsService from "services/GetJobsService"
import GroupJobsService from "services/GroupJobsService"
import { RowIdParts, toRowId, RowId } from "./reactTableUtils"

export const convertRowPartsToFilters = (expandedRowIdParts: RowIdParts[]): JobFilter[] => {
  const filters: JobFilter[] = expandedRowIdParts.map(({ type, value }) => ({
    field: type,
    value,
    match: Match.Exact,
  }))

  return filters
}

export const convertColumnFiltersToFilters = (filters: ColumnFiltersState): JobFilter[] => {
  return filters.map(({ id, value }) => {
    const isArray = _.isArray(value)
    return {
      field: id,
      value: isArray ? (value as string[]) : (value as string),
      match: isArray ? Match.AnyOf : Match.Exact,
    }
  })
}

export interface FetchRowRequest {
  filters: JobFilter[]
  skip: number
  take: number
  order: JobOrder
}
export const fetchJobs = async (rowRequest: FetchRowRequest, getJobsService: GetJobsService) => {
  const { filters, skip, take, order } = rowRequest

  return await getJobsService.getJobs(filters, order, skip, take, undefined)
}

export const fetchJobGroups = async (
  rowRequest: FetchRowRequest,
  groupJobsService: GroupJobsService,
  groupedColumn: string,
  columnsToAggregate: string[],
) => {
  console.log({ rowRequest })
  const { filters, skip, take } = rowRequest
  let { order } = rowRequest

  // Always sort by the grouped field when fetching groups
  // But only respect the direction if the UI is actually sorting by the grouped column
  order = {
    field: "name",
    direction: order.field === groupedColumn ? order.direction : "ASC",
  }

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
      groupedField: groupingField,

      isGroup: true,
      jobCount: group.count,

      // Will be set later if expanded
      subRowCount: undefined,
      subRows: [],
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

export const updaterToValue = <T>(updaterOrValue: Updater<T>, previousValue: T): T => {
  return typeof updaterOrValue === "function" ? (updaterOrValue as (old: T) => T)(previousValue) : updaterOrValue
}
