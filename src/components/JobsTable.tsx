import {
  Button,
  TableContainer,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  CircularProgress,
} from "@mui/material"
import {
  ColumnDef,
  ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  GroupingState,
  PaginationState,
  useReactTable,
} from "@tanstack/react-table"
import React from "react"
import GetJobsService from "services/GetJobsService"
import { GroupAddOutlined, GroupRemoveOutlined, ExpandMore, KeyboardArrowRight, KeyboardArrowDown } from "@mui/icons-material"
import GroupJobsService from "services/GroupJobsService"
import { usePrevious } from "hooks/usePrevious"
import { JobTableRow, JobRow, fetchAllNeededRows, isJobGroupRow, FetchAllNeededRowsRequest } from "utils/jobsTableUtils"
import { ColumnSpec } from "pages/JobsPage"

type JobsPageProps = {
  getJobsService: GetJobsService
  groupJobsService: GroupJobsService
  selectedColumns: ColumnSpec[]
}
export const JobsTable = ({ getJobsService, groupJobsService, selectedColumns }: JobsPageProps) => {
  const [isLoading, setIsLoading] = React.useState(true)
  const [data, setData] = React.useState<JobTableRow[] | undefined>(undefined)

  const columns = React.useMemo<ColumnDef<JobRow>[]>(
    () =>
      selectedColumns.map(
        (c): ColumnDef<JobRow> => ({
          id: c.key,
          accessorKey: c.key,
          header: c.name,
          enableGrouping: c.groupable,
          aggregationFn: () => "-",
        }),
      ),
    [selectedColumns],
  )

  const [grouping, setGrouping] = React.useState<GroupingState>([])
  const [expanded, setExpanded] = React.useState<ExpandedState>({})
  const prevExpanded = usePrevious(expanded)
  const { newlyExpanded, newlyUnexpanded } = React.useMemo(() => {
    const prevExpandedKeys = Object.keys(prevExpanded ?? {})
    const expandedKeys = Object.keys(expanded)

    const newlyExpanded = expandedKeys.filter((e) => !prevExpandedKeys.includes(e))
    const newlyUnexpanded = prevExpandedKeys.filter((e) => !expandedKeys.includes(e))
    return { newlyExpanded, newlyUnexpanded }
  }, [expanded, prevExpanded])

  const [{ pageIndex, pageSize }, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [pageCount, setPageCount] = React.useState<number>(-1)
  const pagination = React.useMemo(
    () => ({
      pageIndex,
      pageSize,
    }),
    [pageIndex, pageSize],
  )

  React.useEffect(() => {
    async function fetchTopLevelData() {
      // TODO: Support filtering

      if (newlyUnexpanded.length > 0) {
        console.log("Not fetching new data since we're unexpanding")
        return
      }

      if (newlyExpanded.length > 1) {
        console.warn("More than one newly expanded!", { newlyExpanded })
      }

      const parentRowId = newlyExpanded.length > 0 ? newlyExpanded[0] : undefined

      const rowRequests: FetchAllNeededRowsRequest = [
        {
          parentRowId: parentRowId,
          skip: parentRowId ? 0 : pageIndex * pageSize,
          take: parentRowId ? Number.MAX_SAFE_INTEGER : pageSize,
        },
      ]

      const { rows, updatedRootCount } = await fetchAllNeededRows(
        rowRequests,
        data ?? [],
        getJobsService,
        groupJobsService,
        selectedColumns,
        grouping,
      )

      setData(rows)
      setIsLoading(false)
      if (updatedRootCount) {
        setPageCount(Math.ceil(updatedRootCount / pageSize))
      }
    }

    fetchTopLevelData().catch(console.error)
  }, [pagination, grouping, expanded])

  const table = useReactTable({
    data: data ?? [],
    columns,
    state: {
      grouping,
      expanded,
      pagination,
    },

    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.rowId,
    getSubRows: (row) => (isJobGroupRow(row) && row.subRows) || undefined,

    manualGrouping: true,
    onGroupingChange: newState => {
      setExpanded({}); // Reset currently-expanded when grouping changes
      setGrouping(newState);
    },
    getGroupedRowModel: getGroupedRowModel(),

    getExpandedRowModel: getExpandedRowModel(),
    onExpandedChange: setExpanded,
    paginateExpandedRows: true,

    manualPagination: true,
    pageCount: pageCount,
    onPaginationChange: setPagination,
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const rowsToRender = table.getRowModel().rows
  const canDisplay = !isLoading && rowsToRender.length > 0
  return (
    <TableContainer component={Paper} className="p-2">
      <Table>
        <TableHead>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableCell key={header.id}>
                    {header.isPlaceholder ? null : (
                      <div>
                        {header.column.getCanGroup() ? (
                          // If the header can be grouped, let's add a toggle
                          <IconButton
                            size="small"
                            {...{
                              onClick: header.column.getToggleGroupingHandler(),
                              style: {
                                cursor: "pointer",
                              },
                            }}
                          >
                            {header.column.getIsGrouped() ? (
                              <>
                                <GroupRemoveOutlined fontSize="small" aria-hidden="false" aria-label="Group By"/> 
                                ({header.column.getGroupedIndex()})
                              </>
                            ) : (
                              <GroupAddOutlined fontSize="small" aria-hidden="false" aria-label="Ungroup By"/>
                            )}
                          </IconButton>
                        ) : null}{" "}
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                    )}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableHead>
        <TableBody>
          {!canDisplay && (
            <TableRow>
              {isLoading && (
                <TableCell colSpan={columns.length}>
                  <CircularProgress />
                </TableCell>
              )}
              {!isLoading && rowsToRender.length === 0 && (
                <TableCell colSpan={columns.length}>There is no data to display</TableCell>
              )}
            </TableRow>
          )}

          {rowsToRender.map((row) => {
            const original = row.original
            const rowIsGrouped = isJobGroupRow(original)
            return (
              <TableRow key={`${row.id}_d${row.depth}`} aria-label={row.id}>
                {row.getVisibleCells().map((cell) => {
                  const cellHasValue = cell.renderValue()
                  return (
                    <TableCell key={cell.id} size="small">
                      {rowIsGrouped && cell.column.getIsGrouped() && cellHasValue ? (
                        // If it's a grouped cell, add an expander and row count
                        <>
                          <Button
                            variant="text"
                            size="small"
                            {...{
                              onClick: () => row.toggleExpanded(),
                              style: {
                                cursor: row.getCanExpand() ? "pointer" : "normal",
                                textTransform: "initial",
                                padding: "initial",
                                color: "initial",
                              },
                            }}
                          >
                            {row.getIsExpanded() ? (
                              <KeyboardArrowDown fontSize="small" aria-label="Expanded" aria-hidden="false" />
                            ) : (
                              <KeyboardArrowRight fontSize="small" aria-label="Collapsed" aria-hidden="false" />
                            )}{" "}
                            {flexRender(cell.column.columnDef.cell, cell.getContext())} (Jobs: {original.count})
                          </Button>
                        </>
                      ) : cell.getIsAggregated() ? (
                        // If the cell is aggregated, use the Aggregated
                        // renderer for cell
                        flexRender(
                          cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell,
                          cell.getContext(),
                        )
                      ) : (
                        flexRender(cell.column.columnDef.cell, cell.getContext())
                      )}
                    </TableCell>
                  )
                })}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <div className="h-2" />
      <div className="flex items-center gap-2">
        <button
          className="border rounded p-1"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
        >
          {"<<"}
        </button>
        <button
          className="border rounded p-1"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          {"<"}
        </button>
        <button className="border rounded p-1" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          {">"}
        </button>
        <button
          className="border rounded p-1"
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
        >
          {">>"}
        </button>
        <span className="flex items-center gap-1">
          <div>Page</div>
          <strong>
            {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </strong>
        </span>
        <span className="flex items-center gap-1">
          | Go to page:
          <input
            type="number"
            defaultValue={table.getState().pagination.pageIndex + 1}
            onChange={(e) => {
              const page = e.target.value ? Number(e.target.value) - 1 : 0
              table.setPageIndex(page)
            }}
            className="border p-1 rounded w-16"
          />
        </span>
        <select
          value={table.getState().pagination.pageSize}
          onChange={(e) => {
            table.setPageSize(Number(e.target.value))
          }}
        >
          {[10, 20, 30, 40, 50].map((pageSize) => (
            <option key={pageSize} value={pageSize}>
              Show {pageSize}
            </option>
          ))}
        </select>
      </div>
      <div>{rowsToRender.length} Rows</div>
    </TableContainer>
  )
}
