// E.g. "job:1", or "queue:queue-2"
// Format comes from ReactTable grouping, see https://github.com/TanStack/table/blob/main/packages/table-core/src/utils/getGroupedRowModel.ts#L59
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
  // Provides key-value info on each part of this row's hierarchy position
  // E.g. [{type: "queue", value: "queue-2"}, {type: "jobSet", value: "job-set-2"}]
  rowIdPartsPath: RowIdParts[]

  // Helper to allow easier navigation of grouped ReactTable data
  // E.g. ["queue:queue-2", "queue:queue-2>jobSet:job-set-2"]
  rowIdPathFromRoot: RowId[]
}
export const fromRowId = (rowId: RowId): RowIdInfo => {
  const rowIdSegments: RowIdSegment[] = rowId.split(">") as RowIdSegment[]

  const rowIdPartsPath = rowIdSegments.map(segment => {
    const [type, value] = segment.split(":");
    return {type, value};
  })

  let lastRowId: RowId | undefined = undefined
  const rowIdPathFromRoot: RowId[] = rowIdPartsPath.map(({type, value}) => {
    lastRowId = toRowId({type, value, parentRowId: lastRowId});
    return lastRowId
  })

  return {
    rowIdPartsPath,
    rowIdPathFromRoot,
  }
}
