import { Job, JobGroup, JobFilter, JobOrder } from "model"
import { ColumnSpec } from "pages/JobsPage"
import GetJobsService from "services/GetJobsService"
import GroupJobsService from "services/GroupJobsService"
import { fromRowId, RowId, RowIdSegment, toRowId } from "./reactTableUtils"

export interface BaseJobTableRow {
  rowId: RowId
}

export interface JobRow extends BaseJobTableRow {
  // Job details
  jobId?: string
  jobSet?: string
  queue?: string
  state?: string
  cpu?: number
  memory?: string
  ephemeralStorage?: string
}

export interface JobGroupRow extends BaseJobTableRow {
  isGroup: true // The ReactTable version of this doesn't seem to play nice with manual/serverside expanding
  count?: number
  subRows?: JobTableRow[]

  // Some subfield of JobRow that this row is grouped on
  [groupedField: string]: unknown
}

export type JobTableRow = JobRow | JobGroupRow

export const isJobGroupRow = (row: JobTableRow): row is JobGroupRow => "isGroup" in row

export interface FetchRowRequest {
  parentRowId: RowId | undefined // Undefined means root rows
  skip: number
  take: number
}

function jobsToRows(jobs: Job[]): JobRow[] {
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

function groupsToRows(groups: JobGroup[], baseRowId: RowId | undefined, groupingField: string): JobGroupRow[] {
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

interface FetchRowsResult {
  rows: JobRow[]
  totalCount: number
}
const fetchRows = async (
  rowRequest: FetchRowRequest,
  getJobsService: GetJobsService,
  groupJobsService: GroupJobsService,
  selectedColumns: ColumnSpec[],
  currentGroupedColumns: string[],
): Promise<FetchRowsResult> => {
  const { parentRowId, skip, take } = rowRequest
  const parentInfo = parentRowId ? fromRowId(parentRowId) : undefined

  const groupingLevel = currentGroupedColumns.length
  const expandedLevel = parentInfo ? parentInfo.rowIdPathFromRoot.length + 1 : 0

  console.log({ groupingLevel, expandedLevel, parentInfo })

  if (groupingLevel === expandedLevel) {
    // Time to request jobs
    const filters: JobFilter[] =
      parentRowId
        ?.split(">")
        .map((s) => s.split(":"))
        .map(([field, value]) => ({
          field,
          value,
          match: "exact",
        })) ?? []

    const order: JobOrder = { field: "jobId", direction: "ASC" }
    const { jobs, totalJobs } = await getJobsService.getJobs(filters, order, skip, take, undefined)

    const newJobRows = jobsToRows(jobs)

    return { rows: newJobRows, totalCount: totalJobs }
  } else {
    // Need to request groups, filtered to current
    const fields = parentRowId?.split(">").map((s) => s.split(":")) ?? []

    const filters: JobFilter[] = fields.map(([filterField, filterValue]) => ({
      field: filterField,
      value: filterValue,
      match: "exact",
    }))

    const order: JobOrder = { field: "name", direction: "ASC" }
    const groupingField = currentGroupedColumns[expandedLevel]
    const { groups, totalGroups } = await groupJobsService.groupJobs(
      filters,
      order,
      groupingField,
      selectedColumns.filter((c) => c.groupable).map((c) => c.key),
      skip,
      take,
      undefined,
    )

    const newGroupRows = groupsToRows(groups, parentRowId, groupingField)
    return { rows: newGroupRows, totalCount: totalGroups }
  }
}

export const mergeRows = (existingData: JobTableRow[], newRows: FetchRowsResult, parentRowsPath: RowIdSegment[]) => {
  // Just return if this is the top-level data
  // const parentToFind = rowRequest.parentRowId
  if (parentRowsPath.length === 0) {
    return { rows: newRows.rows, updatedRootCount: newRows.totalCount }
  }

  // Otherwise merge it into existing data
  const rowIdsPathForParent = parentRowsPath.reduce<string[]>((paths, newLevel) => {
    const prev = paths.length > 0 ? paths[paths.length - 1] : undefined
    return paths.concat([(prev ? prev + ">" : "") + newLevel])
  }, [])

  const rowToModify: JobGroupRow | undefined = rowIdsPathForParent.reduce<JobGroupRow | undefined>(
    (row, rowIdToFind) => {
      const candidateRow = row?.subRows?.find((r) => r.rowId === rowIdToFind)
      if (candidateRow && isJobGroupRow(candidateRow)) {
        return candidateRow
      }
    },
    { subRows: existingData } as JobGroupRow,
  )

  // Modifies in-place for now
  if (rowToModify) {
    rowToModify.subRows = newRows.rows
  } else {
    console.warn("Could not find row to merge with path. This is a bug.", rowIdsPathForParent)
  }

  return { rows: [...existingData], updatedRootCount: undefined }
}

export type FetchAndMergeNewRowsResult = {
  rows: JobTableRow[]
  updatedRootCount?: number
}
export const fetchAndMergeNewRows = async (
  rowRequest: FetchRowRequest,
  existingData: JobTableRow[],
  getJobsService: GetJobsService,
  groupJobsService: GroupJobsService,
  selectedColumns: ColumnSpec[],
  currentGroupedColumns: string[],
): Promise<FetchAndMergeNewRowsResult> => {
  const response = await fetchRows(rowRequest, getJobsService, groupJobsService, selectedColumns, currentGroupedColumns)

  const parentRowsPath = (rowRequest.parentRowId?.split(">") as RowIdSegment[]) ?? []
  return mergeRows(existingData, response, parentRowsPath)
}
