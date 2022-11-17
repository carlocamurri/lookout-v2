import { Job, JobGroup, JobFilter, JobOrder } from "model"
import { ColumnSpec } from "pages/JobsPage"
import GetJobsService from "services/GetJobsService"
import GroupJobsService from "services/GroupJobsService"

export interface BaseJobTableRow {
  rowId: string
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

function jobsToRows(jobs: Job[]): JobRow[] {
  return jobs.map(
    (job): JobRow => ({
      rowId: "job:" + job.jobId,
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

function groupsToRows(groups: JobGroup[], baseRowId: string, groupingField: string): JobGroupRow[] {
  return groups.map(
    (group): JobGroupRow => ({
      rowId: baseRowId + groupingField + ":" + group.name,
      [groupingField]: group.name,

      isGroup: true,
      count: group.count,
      subRows: [], // Will be set later if expanded
    }),
  )
}

interface FetchRowRequest {
  parentRowId: string | undefined // Undefined means root rows
  skip: number
  take: number
}
interface FetchRowResult {
  rows: JobRow[]
  totalCount: number
}
const fetchRows = async (
  rowRequest: FetchRowRequest,
  getJobsService: GetJobsService,
  groupJobsService: GroupJobsService,
  selectedColumns: ColumnSpec[],
  currentGroupedColumns: string[],
): Promise<FetchRowResult> => {
  const { parentRowId, skip, take } = rowRequest

  const groupingLevel = currentGroupedColumns.length
  const expandedLevel = parentRowId ? parentRowId.split(">").length : 0
  const baseRowId = parentRowId ? parentRowId + ">" : ""

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

    const newGroupRows = groupsToRows(groups, baseRowId, groupingField)
    console.log("Got subgroup rows:", newGroupRows)

    return { rows: newGroupRows, totalCount: totalGroups }
  }
}

export type FetchAllNeededRowsRequest = FetchRowRequest[]
export type FetchAllNeededRowsResult = {
  rows: JobTableRow[]
  updatedRootCount?: number
}
export const fetchAllNeededRows = async (
  rowRequests: FetchAllNeededRowsRequest,
  existingData: JobTableRow[],
  getJobsService: GetJobsService,
  groupJobsService: GroupJobsService,
  selectedColumns: ColumnSpec[],
  currentGroupedColumns: string[],
): Promise<FetchAllNeededRowsResult> => {
  const responses = await Promise.all(
    rowRequests.map(async (rowRequest) => ({
      rowRequest: rowRequest,
      fetchResponse: await fetchRows(
        rowRequest,
        getJobsService,
        groupJobsService,
        selectedColumns,
        currentGroupedColumns,
      ),
    })),
  )

  let updatedRootCount = undefined
  const mergedData: JobTableRow[] = responses.reduce<JobTableRow[]>(
    (partiallyMergedData, response) => {
      const parentToFind = response.rowRequest.parentRowId
      if (!parentToFind) {
        updatedRootCount = response.fetchResponse.totalCount
        return response.fetchResponse.rows
      }

      const rowIdsPathForParent = parentToFind?.split(">").reduce<string[]>((paths, newLevel) => {
        const prev = paths.length > 0 ? paths[paths.length - 1] : undefined
        return paths.concat([(prev ? prev + ">" : "") + newLevel])
      }, [])

      console.log({ parentToFind, rowIdsPathForParent })

      const rowToModify: JobGroupRow | undefined = rowIdsPathForParent.reduce<JobGroupRow | undefined>(
        (row, rowIdToFind) => {
          const candidateRow = row?.subRows?.find((r) => r.rowId === rowIdToFind)
          if (candidateRow && isJobGroupRow(candidateRow)) {
            return candidateRow
          }
        },
        { subRows: partiallyMergedData } as JobGroupRow,
      )

      if (rowToModify) {
        rowToModify.subRows = response.fetchResponse.rows
        console.log({ rowToModify })
      } else {
        console.warn("Could not find row to merge with path. This is a bug.", rowIdsPathForParent)
      }

      return partiallyMergedData
    },
    [...existingData],
  )

  return { rows: mergedData, updatedRootCount }
}
