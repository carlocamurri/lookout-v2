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
  TablePagination,
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
import { GroupAddOutlined, GroupRemoveOutlined, ExpandMore, KeyboardArrowRight } from "@mui/icons-material"
import GroupJobsService from "services/GroupJobsService"
import { usePrevious } from "hooks/usePrevious"
import { fromRowId, mergeSubRows, RowId } from "utils/reactTableUtils"
import { JobTableRow, JobRow, isJobGroupRow } from "models/jobsTableModels"
import { convertExpandedRowFieldsToFilters, fetchJobGroups, fetchJobs, groupsToRows, jobsToRows } from "utils/jobsTableUtils"
import { ColumnSpec } from "utils/jobsTableColumns"

type JobsPageProps = {
  getJobsService: GetJobsService
  groupJobsService: GroupJobsService
  selectedColumns: ColumnSpec[]
}
export const JobsTable = ({ getJobsService, groupJobsService, selectedColumns }: JobsPageProps) => {
  const [isLoading, setIsLoading] = React.useState(true)
  const [data, setData] = React.useState<JobTableRow[]>([])
  const [totalRowCount, setTotalRowCount] = React.useState(0);

  const columns = React.useMemo<ColumnDef<JobRow>[]>(
    () =>
      selectedColumns.map(
        (c): ColumnDef<JobRow> => ({
          id: c.key,
          accessorKey: c.key,
          header: c.name,
          enableGrouping: c.groupable,
          aggregationFn: () => "-",
          minSize: c.minSize,
          size: c.minSize
        }),
      ),
    [selectedColumns],
  )

  const [grouping, setGrouping] = React.useState<GroupingState>([])
  const [expanded, setExpanded] = React.useState<ExpandedState>({})
  const prevExpanded = usePrevious(expanded)
  const { newlyExpanded, newlyUnexpanded } = React.useMemo(() => {
    const prevExpandedKeys = Object.keys(prevExpanded ?? {}) as RowId[]
    const expandedKeys = Object.keys(expanded) as RowId[]

    const newlyExpanded: RowId[] = expandedKeys.filter((e) => !prevExpandedKeys.includes(e))
    const newlyUnexpanded: RowId[] = prevExpandedKeys.filter((e) => !expandedKeys.includes(e))
    return { newlyExpanded, newlyUnexpanded }
  }, [expanded, prevExpanded])

  const [{ pageIndex, pageSize }, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 30,
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
    async function fetchData() {
      // TODO: Support filtering

      if (newlyUnexpanded.length > 0) {
        console.log("Not fetching new data since we're unexpanding")
        return
      }

      if (newlyExpanded.length > 1) {
        console.warn("More than one newly expanded!", { newlyExpanded })
      }

      const expandedRowInfo = newlyExpanded.length > 0 ? fromRowId(newlyExpanded[0]) : undefined;

      const groupingLevel = grouping.length
      const expandedLevel = expandedRowInfo ? expandedRowInfo.rowIdPathFromRoot.length : 0

      const rowRequest = {
        filters: convertExpandedRowFieldsToFilters(expandedRowInfo?.rowIdPartsPath ?? []),
        skip: expandedRowInfo ? 0 : pageIndex * pageSize,
        take: expandedRowInfo ? Number.MAX_SAFE_INTEGER : pageSize,
      }

      let newData, totalCount;
      if (expandedLevel === groupingLevel) {
        const {jobs, totalJobs} = await fetchJobs(rowRequest, getJobsService);
        newData = jobsToRows(jobs);
        totalCount = totalJobs;
      } else {
        const groupedCol = grouping[expandedLevel];
        const colsToAggregate = selectedColumns.filter(c => c.groupable).map(c => c.key);
        const {groups, totalGroups} = await fetchJobGroups(rowRequest, groupJobsService, groupedCol, colsToAggregate)
        newData = groupsToRows(groups, expandedRowInfo?.rowId, groupedCol)
        totalCount = totalGroups;
      }

      const mergedData = mergeSubRows(data, newData, expandedRowInfo?.rowIdPathFromRoot ?? [])

      setData([...mergedData]) // ReactTable will only re-render if the array identity changes
      setIsLoading(false)
      if (expandedRowInfo === undefined) {
        setPageCount(Math.ceil(totalCount / pageSize))
        setTotalRowCount(totalCount);
      }
    }

    fetchData().catch(console.error)
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
    onGroupingChange: setGrouping,
    getGroupedRowModel: getGroupedRowModel(),

    getExpandedRowModel: getExpandedRowModel(),
    onExpandedChange: setExpanded,
    autoResetExpanded: false,
    manualExpanding: false,
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
    <div>
    <TableContainer component={Paper} sx={{margin: "0px"}}>
      <Table sx={{marginBottom: "8px"}}>
        <TableHead>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} hover>
              {headerGroup.headers.map((header) => {
                console.log("Header", header, header.column.getSize());
                return (
                  <TableCell key={header.id}
                             style={{
                              minWidth: header.column.getSize(),
                              padding: "8px"
                            }}
                  >
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
                                <GroupRemoveOutlined fontSize="small" /> ({header.column.getGroupedIndex()})
                              </>
                            ) : (
                              <GroupAddOutlined fontSize="small" />
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
              <TableRow key={`${row.id}_d${row.depth}`} 
                        aria-label={row.id} 
                        hover
              >
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
                              <ExpandMore fontSize="small" />
                            ) : (
                              <KeyboardArrowRight fontSize="small" />
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
    </div>
  )
}
