// E.g. "job:1", or "queue:queue-2"
// Format comes from ReactTable grouping, see https://github.com/TanStack/table/blob/main/packages/table-core/src/utils/getGroupedRowModel.ts#L59

import { isJobGroupRow, JobGroupRow, JobTableRow } from "models/jobsTableModels"

// It's convenient to just use this same format everywhere
export type RowIdSegment = `${string}:${string}`

// E.g. "job:1", or "jobSet:job-set-2>job:1"
// Format comes from ReactTable grouping, see https://github.com/TanStack/table/blob/main/packages/table-core/src/utils/getGroupedRowModel.ts#L60
export type RowId = RowIdSegment | `${RowIdSegment}>${RowIdSegment}`

export type RowIdParts = {
  type: string
  value: string
  parentRowId?: RowId
}
export const toRowId = ({ type, value, parentRowId }: RowIdParts): RowId => {
  const rowIdSegment: RowIdSegment = `${type}:${value}`
  return parentRowId ? `${parentRowId}>${rowIdSegment}` : rowIdSegment
}

export type RowIdInfo = {
  rowId: RowId

  // Provides key-value info on each part of this row's hierarchy position
  // E.g. [{type: "queue", value: "queue-2"}, {type: "jobSet", value: "job-set-2"}]
  rowIdPartsPath: RowIdParts[]

  // Helper to allow easier navigation of grouped ReactTable data
  // E.g. ["queue:queue-2", "queue:queue-2>jobSet:job-set-2"]
  rowIdPathFromRoot: RowId[]
}
export const fromRowId = (rowId: RowId): RowIdInfo => {
  const rowIdSegments: RowIdSegment[] = rowId.split(">") as RowIdSegment[]

  const rowIdPartsPath = rowIdSegments.map((segment) => {
    const [type, value] = segment.split(":")
    return { type, value }
  })

  let lastRowId: RowId | undefined = undefined
  const rowIdPathFromRoot: RowId[] = rowIdPartsPath.map(({ type, value }) => {
    lastRowId = toRowId({ type, value, parentRowId: lastRowId })
    return lastRowId
  })

  return {
    rowId: rowId,
    rowIdPartsPath,
    rowIdPathFromRoot,
  }
}

export interface RowWithOptionalSubRows {
  rowId: RowId
  subRows?: RowWithOptionalSubRows[]
}

/**
 * Merges new rows (which may or may not be subrows) with existing data.
 */
export const mergeSubRows = (existingData: JobTableRow[], newSubRows: JobTableRow[], locationForSubRows: RowId[], appendSubRows: boolean) => {
  // Just return if this is the top-level data
  if (locationForSubRows.length === 0) {
    return { rootData: newSubRows }
  }

  // Otherwise merge it into existing data
  const rowToModify: JobGroupRow | undefined = locationForSubRows.reduce<JobGroupRow | undefined>(
    (row, rowIdToFind) => {
      if (isJobGroupRow(row)) {
        const candidateRow: JobTableRow | undefined = row.subRows?.find((r) => r.rowId === rowIdToFind)
        if (isJobGroupRow(candidateRow)) {
          return candidateRow
        }
      }
      // TODO: Change subRows to a set to optimise this lookup
    },
    { isGroup: true, subRows: existingData } as JobGroupRow,
  )

  // Modifies in-place for now
  if (rowToModify) {
    if (appendSubRows) {
      rowToModify.subRows = (rowToModify.subRows ?? []).concat(newSubRows)
    } else {
      rowToModify.subRows = newSubRows;
    }
    
  } else {
    console.warn("Could not find row to merge with path. This is a bug.", locationForSubRows)
  }

  return { rootData: existingData, parentRow: rowToModify }
}
