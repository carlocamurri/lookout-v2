import {
  TableContainer,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  TablePagination,
} from "@mui/material"
import {
  ColumnDef,
  ExpandedState,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  GroupingState,
  PaginationState,
  Row,
  useReactTable,
} from "@tanstack/react-table"
import React, { useCallback, useMemo, useState } from "react"
import GetJobsService from "services/GetJobsService"
import GroupJobsService from "services/GroupJobsService"
import { usePrevious } from "hooks/usePrevious"
import { fromRowId, mergeSubRows, RowId } from "utils/reactTableUtils"
import { JobTableRow, JobRow, isJobGroupRow } from "models/jobsTableModels"
import {
  convertExpandedRowFieldsToFilters,
  fetchJobGroups,
  fetchJobs,
  groupsToRows,
  jobsToRows,
} from "utils/jobsTableUtils"
import { ColumnId, DEFAULT_COLUMN_SPECS, DEFAULT_GROUPING } from "utils/jobsTableColumns"
import { BodyCell, HeaderCell } from "./JobsTableCell"
import { JobsTableActionBar } from "./JobsTableActionBar"

type JobsPageProps = {
  getJobsService: GetJobsService
  groupJobsService: GroupJobsService
}
export const JobsTable = ({ getJobsService, groupJobsService }: JobsPageProps) => {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<JobTableRow[]>([])
  const [totalRowCount, setTotalRowCount] = useState(0)
  const [allColumns, setAllColumns] = useState(DEFAULT_COLUMN_SPECS);

  const selectedColumnDefs = useMemo<ColumnDef<JobTableRow>[]>(
    () =>
      allColumns
        .filter(c => c.selected)
        .map(
          (c): ColumnDef<JobTableRow> => ({
            id: c.key,
            accessorKey: c.key,
            header: c.name,
            enableGrouping: c.groupable,
            aggregationFn: () => "-",
            minSize: c.minSize,
            size: c.minSize,
            ...(c.formatter ? { cell: (info) => c.formatter?.(info.getValue()) } : {}),
          }),
        ),
    [allColumns],
  )

  const [grouping, setGrouping] = useState<ColumnId[]>(DEFAULT_GROUPING)
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const prevExpanded = usePrevious(expanded)
  const { newlyExpanded, newlyUnexpanded } = useMemo(() => {
    const prevExpandedKeys = Object.keys(prevExpanded ?? {}) as RowId[]
    const expandedKeys = Object.keys(expanded) as RowId[]

    const newlyExpanded: RowId[] = expandedKeys.filter((e) => !prevExpandedKeys.includes(e))
    const newlyUnexpanded: RowId[] = prevExpandedKeys.filter((e) => !expandedKeys.includes(e))
    return { newlyExpanded, newlyUnexpanded }
  }, [expanded, prevExpanded])

  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 30,
  })
  const [pageCount, setPageCount] = useState<number>(-1)
  const pagination = useMemo(
    () => ({
      pageIndex,
      pageSize,
    }),
    [pageIndex, pageSize],
  )

  const [hoveredHeaderColumn, setHoveredHeaderColumn] = React.useState<ColumnId | undefined>(undefined)

  React.useEffect(() => {
    async function fetchData() {
      // TODO: Support filtering

      if (newlyUnexpanded.length > 0) {
        console.log("Not fetching new data since we're unexpanding")
        return
      }

      if (newlyExpanded.length > 1) {
        console.warn("More than one newly expanded!", { newlyExpanded })
      }

      const expandedRowInfo = newlyExpanded.length > 0 ? fromRowId(newlyExpanded[0]) : undefined

      const groupingLevel = grouping.length
      const expandedLevel = expandedRowInfo ? expandedRowInfo.rowIdPathFromRoot.length : 0

      const rowRequest = {
        filters: convertExpandedRowFieldsToFilters(expandedRowInfo?.rowIdPartsPath ?? []),
        skip: expandedRowInfo ? 0 : pageIndex * pageSize,
        take: expandedRowInfo ? Number.MAX_SAFE_INTEGER : pageSize,
      }

      let newData, totalCount
      if (expandedLevel === groupingLevel) {
        const { jobs, totalJobs } = await fetchJobs(rowRequest, getJobsService)
        newData = jobsToRows(jobs)
        totalCount = totalJobs
      } else {
        const groupedCol = grouping[expandedLevel]
        const colsToAggregate = allColumns.filter((c) => c.groupable).map((c) => c.key)
        const { groups, totalGroups } = await fetchJobGroups(rowRequest, groupJobsService, groupedCol, colsToAggregate)
        newData = groupsToRows(groups, expandedRowInfo?.rowId, groupedCol)
        totalCount = totalGroups
      }

      const mergedData = mergeSubRows(data, newData, expandedRowInfo?.rowIdPathFromRoot ?? [])

      setData([...mergedData]) // ReactTable will only re-render if the array identity changes
      setIsLoading(false)
      if (expandedRowInfo === undefined) {
        setPageCount(Math.ceil(totalCount / pageSize))
        setTotalRowCount(totalCount)
      }
    }

    fetchData().catch(console.error)
  }, [pagination, grouping, expanded])

  const onGroupingChange = useCallback((newState: ColumnId[]) => {
    setExpanded({}) // Reset currently-expanded when grouping changes
    setGrouping(newState)
  }, [setExpanded, setGrouping]);

  const table = useReactTable({
    data: data ?? [],
    columns: selectedColumnDefs,
    state: {
      grouping,
      expanded,
      pagination,
    },
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.rowId,
    getSubRows: (row) => (isJobGroupRow(row) && row.subRows) || undefined,

    // Grouping
    manualGrouping: true,
    // onGroupingChange: onGroupingChange,
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    onExpandedChange: setExpanded,
    autoResetExpanded: false,
    manualExpanding: false,

    // Pagination
    manualPagination: true,
    pageCount: pageCount,
    paginateExpandedRows: true,
    onPaginationChange: setPagination,
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const rowsToRender = table.getRowModel().rows
  return (
    <>
      <JobsTableActionBar allColumns={allColumns} groupedColumns={grouping} onColumnsChanged={setAllColumns} onGroupsChanged={onGroupingChange} />
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <HeaderCell
                    header={header}
                    hoveredColumn={hoveredHeaderColumn}
                    onHoverChange={setHoveredHeaderColumn}
                    key={header.id}
                  />
                ))}
              </TableRow>
            ))}
          </TableHead>

          <JobsTableBody dataIsLoading={isLoading} columns={selectedColumnDefs} rowsToRender={rowsToRender} />
        </Table>
      </TableContainer>

      <TablePagination
        rowsPerPageOptions={[10, 20, 30, 40, 50]}
        component="div"
        count={totalRowCount}
        rowsPerPage={pageSize}
        page={pageIndex}
        onPageChange={(_, page) => table.setPageIndex(page)}
        onRowsPerPageChange={(e) => table.setPageSize(Number(e.target.value))}
      />
    </>
  )
}

interface JobsTableBodyProps {
  dataIsLoading: boolean
  columns: ColumnDef<JobTableRow>[]
  rowsToRender: Row<JobTableRow>[]
}
const JobsTableBody = React.memo(({ dataIsLoading, columns, rowsToRender }: JobsTableBodyProps) => {
  // This memoized component saves re-rendering if the data to display hasn't changed
  const canDisplay = !dataIsLoading && rowsToRender.length > 0
  return (
    <TableBody>
      {!canDisplay && (
        <TableRow>
          {dataIsLoading && (
            <TableCell colSpan={columns.length}>
              <CircularProgress />
            </TableCell>
          )}
          {!dataIsLoading && rowsToRender.length === 0 && (
            <TableCell colSpan={columns.length}>There is no data to display</TableCell>
          )}
        </TableRow>
      )}

      {rowsToRender.map((row) => {
        const original = row.original
        const rowIsGroup = isJobGroupRow(original)
        return (
          <TableRow key={`${row.id}_d${row.depth}`} aria-label={row.id} hover>
            {row.getVisibleCells().map((cell) => (
              <BodyCell
                cell={cell}
                rowIsGroup={rowIsGroup}
                rowIsExpanded={row.getIsExpanded()}
                onExpandedChange={row.toggleExpanded}
                subCount={rowIsGroup ? original.count : undefined}
                key={cell.id}
              />
            ))}
          </TableRow>
        )
      })}
    </TableBody>
  )
})
