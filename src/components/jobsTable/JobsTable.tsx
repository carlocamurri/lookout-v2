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
  TableFooter,
} from "@mui/material"
import {
  ColumnDef,
  ExpandedStateList,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  PaginationState,
  Row,
  RowSelectionState,
  useReactTable,
  Updater,
  ExpandedState,
} from "@tanstack/react-table"
import { useCallback, useEffect, useMemo, useState } from "react"
import GetJobsService from "services/GetJobsService"
import GroupJobsService from "services/GroupJobsService"
import { fromRowId, mergeSubRows, RowId } from "utils/reactTableUtils"
import { JobTableRow, isJobGroupRow } from "models/jobsTableModels"
import {
  convertExpandedRowFieldsToFilters,
  fetchJobGroups,
  fetchJobs,
  groupsToRows,
  jobsToRows,
  diffOfKeys,
  updaterToValue,
} from "utils/jobsTableUtils"
import { ColumnId, columnSpecFor, DEFAULT_COLUMN_SPECS, DEFAULT_GROUPING } from "utils/jobsTableColumns"
import { BodyCell, HeaderCell } from "./JobsTableCell"
import { JobsTableActionBar } from "./JobsTableActionBar"
import { getSelectedColumnDef } from "./SelectedColumn"
import { useStateWithPrevious } from "hooks/useStateWithPrevious"
import _ from "lodash"

const DEFAULT_PAGE_SIZE = 30

type JobsPageProps = {
  getJobsService: GetJobsService
  groupJobsService: GroupJobsService
}
export const JobsTable = ({ getJobsService, groupJobsService }: JobsPageProps) => {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<JobTableRow[]>([])
  const [totalRowCount, setTotalRowCount] = useState(0)
  const [allColumns, setAllColumns] = useState(DEFAULT_COLUMN_SPECS)

  const [grouping, setGrouping, prevGrouping] = useStateWithPrevious<ColumnId[]>(DEFAULT_GROUPING)
  const [expanded, setExpanded, prevExpanded] = useStateWithPrevious<ExpandedStateList>({})
  const [newlyExpanded, newlyUnexpanded] = useMemo(
    () => diffOfKeys<RowId>(expanded, prevExpanded),
    [expanded, prevExpanded],
  )
  const [selectedRows, setSelectedRows] = useState<RowSelectionState>({})

  const [pagination, setPagination, prevPagination] = useStateWithPrevious<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  })
  const [pageCount, setPageCount] = useState<number>(-1)
  const { pageIndex, pageSize } = useMemo(() => pagination, [pagination])

  const [hoveredHeaderColumn, setHoveredHeaderColumn] = useState<ColumnId | undefined>(undefined)

  useEffect(() => {
    async function fetchData() {
      // TODO: Support filtering
      const groupingUnchanged = _.isEqual(grouping, prevGrouping)
      const expandedUnchanged = _.isEqual(expanded, prevExpanded)
      const paginationUnchanged = _.isEqual(pagination, prevPagination)

      // Relying purely on useEffect's dependencies array doesn't work perfectly (e.g. for hot reloads)
      if (groupingUnchanged && expandedUnchanged && paginationUnchanged) {
        console.log("Not fetching any data as no relevant state has changed")
        return
      }

      if (groupingUnchanged && paginationUnchanged && newlyUnexpanded.length > 0) {
        console.log("Not fetching new data since we're only unexpanding")
        return
      }

      if (newlyExpanded.length > 1) {
        console.warn("More than one newly expanded! This may be a bug.", { newlyExpanded })
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

  const onGroupingChange = useCallback(
    (newState: ColumnId[]) => {
      // Reset currently expanded/selected when grouping changes
      setSelectedRows({})
      setExpanded({})

      // Check all grouping columns are displayed
      setAllColumns(
        allColumns.map((col) => ({
          ...col,
          selected: newState.includes(col.key) ? true : col.selected,
        })),
      )

      setGrouping([...newState])
    },
    [setSelectedRows, setExpanded, setAllColumns, allColumns, setGrouping],
  )

  const onPaginationChange = useCallback(
    (updater: Updater<PaginationState>) => {
      const newPagination = updaterToValue(updater, pagination)
      // Reset currently expanded/selected when grouping changes
      // TODO: Consider allowing rows to be selected across pages?
      setSelectedRows({})
      setExpanded({})
      setPagination(newPagination)
    },
    [pagination, setPagination, setSelectedRows, setExpanded],
  )

  const onExpandedChange = useCallback(
    (updater: Updater<ExpandedState>) => {
      const newExpandedOrBool = updaterToValue(updater, expanded)
      const newExpanded =
        typeof newExpandedOrBool === "boolean"
          ? _.fromPairs(table.getRowModel().flatRows.map((r) => [r.id, true]))
          : newExpandedOrBool
      setExpanded(newExpanded)
    },
    [setExpanded, expanded],
  )

  const tableState = useMemo(
    () => ({
      grouping,
      expanded,
      pagination,
      rowSelection: selectedRows,
    }),
    [grouping, expanded, pagination, selectedRows],
  )

  const selectedColumnDefs = useMemo<ColumnDef<JobTableRow>[]>(() => {
    const fixedStartColumns = [getSelectedColumnDef()]
    const restOfColumns = [
      ...grouping.map(columnSpecFor),
      ...allColumns.filter((c) => c.selected && !grouping.includes(c.key)),
    ].map(
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
    )

    return [...fixedStartColumns, ...restOfColumns]
  }, [allColumns, grouping])

  const table = useReactTable({
    data: data ?? [],
    columns: selectedColumnDefs,
    state: tableState,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.rowId,
    getSubRows: (row) => (isJobGroupRow(row) && row.subRows) || undefined,

    // Selection
    enableRowSelection: true,
    enableMultiRowSelection: true,
    enableSubRowSelection: true,
    onRowSelectionChange: setSelectedRows,

    // Grouping
    manualGrouping: true,
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    onExpandedChange: onExpandedChange,
    autoResetExpanded: false,
    manualExpanding: false,
    groupedColumnMode: false, // Retain manual control over column ordering

    // Pagination
    manualPagination: true,
    pageCount: pageCount,
    paginateExpandedRows: true,
    onPaginationChange: onPaginationChange,
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  // Update any new children of selected rows
  useMemo(() => {
    const selectedRowIds = Object.keys(selectedRows) as RowId[]
    selectedRowIds.forEach((rowId) => {
      try {
        const row = table.getRow(rowId)
        if (row.getIsSelected() && !row.getIsSomeSelected()) {
          row.subRows.forEach((subRow) => {
            if (!subRow.getIsSelected()) {
              subRow.toggleSelected(true)
            }
          })
        }
      } catch (e) {
        console.warn("Could not update all selected subrows for row: " + rowId, e)
      }
    })
  }, [data])

  const rowsToRender = table.getRowModel().rows
  return (
    <>
      <JobsTableActionBar
        allColumns={allColumns}
        groupedColumns={grouping}
        onColumnsChanged={setAllColumns}
        onGroupsChanged={onGroupingChange}
      />
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

          <TableFooter>
            <TableRow>
              <TablePagination
                rowsPerPageOptions={[10, 20, 30, 40, 50]}
                count={totalRowCount}
                rowsPerPage={pageSize}
                page={pageIndex}
                onPageChange={(_, page) => table.setPageIndex(page)}
                onRowsPerPageChange={(e) => table.setPageSize(Number(e.target.value))}
                colSpan={selectedColumnDefs.length}
              />
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
    </>
  )
}

interface JobsTableBodyProps {
  dataIsLoading: boolean
  columns: ColumnDef<JobTableRow>[]
  rowsToRender: Row<JobTableRow>[]
}
const JobsTableBody = ({ dataIsLoading, columns, rowsToRender }: JobsTableBodyProps) => {
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
}
