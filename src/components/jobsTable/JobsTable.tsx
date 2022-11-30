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
  Button,
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
import React, { useCallback, useEffect, useMemo, useState } from "react"
import GetJobsService from "services/GetJobsService"
import GroupJobsService from "services/GroupJobsService"
import { fromRowId, mergeSubRows, RowId } from "utils/reactTableUtils"
import { JobTableRow, isJobGroupRow, JobRow, JobGroupRow } from "models/jobsTableModels"
import {
  convertRowPartsToFilters,
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
import { JobId } from "model"
import styles from "./JobsTable.module.css"

const DEFAULT_PAGE_SIZE = 30

type JobsPageProps = {
  getJobsService: GetJobsService
  groupJobsService: GroupJobsService
  debug: boolean
}
export const JobsTable = ({ getJobsService, groupJobsService, debug }: JobsPageProps) => {
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
  const selectedJobs: JobId[] = useMemo(
    () =>
      Object.keys(selectedRows)
        .map((rowId) => {
          const { rowIdPartsPath } = fromRowId(rowId as RowId)
          return rowIdPartsPath.find((part) => part.type === "job")?.value
        })
        .filter((jobId): jobId is JobId => jobId !== undefined),
    [selectedRows],
  )

  const [pagination, setPagination, prevPagination] = useStateWithPrevious<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  })
  const [pageCount, setPageCount] = useState<number>(-1)
  const { pageIndex, pageSize } = useMemo(() => pagination, [pagination])
  const [subRowToLoadMore, setSubRowToLoadMore] = useState<{ rowId: RowId; skip: number } | undefined>(undefined)

  const [hoveredHeaderColumn, setHoveredHeaderColumn] = useState<ColumnId | undefined>(undefined)

  useEffect(() => {
    async function fetchData() {
      // TODO: Support filtering
      const groupingUnchanged = _.isEqual(grouping, prevGrouping)
      const expandedUnchanged = _.isEqual(expanded, prevExpanded)
      const paginationUnchanged = _.isEqual(pagination, prevPagination)
      const noSubRowToLoadMore = subRowToLoadMore === undefined

      // Relying purely on useEffect's dependencies array doesn't work perfectly (e.g. for hot reloads)
      if (groupingUnchanged && expandedUnchanged && paginationUnchanged && noSubRowToLoadMore) {
        console.log("Not fetching any data as no relevant state has changed")
        return
      }

      if (groupingUnchanged && paginationUnchanged && noSubRowToLoadMore && newlyUnexpanded.length > 0) {
        console.log("Not fetching new data since we're only unexpanding")
        return
      }

      const rowsNeedingSubRowsFetched = [subRowToLoadMore?.rowId, ...newlyExpanded].filter(
        (r): r is RowId => r !== undefined,
      )
      if (rowsNeedingSubRowsFetched.length > 1) {
        console.warn("More than one row needing subrows fetched! This may be a bug.", { newlyExpanded })
      }

      const rowToLoadSubRowsFor =
        rowsNeedingSubRowsFetched.length > 0 ? fromRowId(rowsNeedingSubRowsFetched[0]) : undefined

      const groupingLevel = grouping.length
      const expandedLevel = rowToLoadSubRowsFor ? rowToLoadSubRowsFor.rowIdPathFromRoot.length : 0

      console.log({ rowsNeedingSubRowsFetched, groupingLevel, expandedLevel })

      const skip = !rowToLoadSubRowsFor ? pageIndex * pageSize : subRowToLoadMore ? subRowToLoadMore.skip : 0

      const rowRequest = {
        filters: convertRowPartsToFilters(rowToLoadSubRowsFor?.rowIdPartsPath ?? []),
        skip,
        take: pageSize,
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
        newData = groupsToRows(groups, rowToLoadSubRowsFor?.rowId, groupedCol)
        totalCount = totalGroups
      }

      const { rootData, parentRow } = mergeSubRows<JobRow, JobGroupRow>(
        data,
        newData,
        rowToLoadSubRowsFor?.rowIdPathFromRoot ?? [],
        !!subRowToLoadMore,
      )

      if (parentRow) {
        parentRow.subRowCount = totalCount

        // Update any new children of selected rows
        if (parentRow.rowId in selectedRows) {
          const newSelectedRows = parentRow.subRows.reduce(
            (newSelectedSubRows, subRow) => {
              newSelectedSubRows[subRow.rowId] = true
              return newSelectedSubRows
            },
            { ...selectedRows },
          )
          setSelectedRows(newSelectedRows)
        }
      }

      setData([...rootData]) // ReactTable will only re-render if the array identity changes
      setIsLoading(false)
      setSubRowToLoadMore(undefined)
      if (rowToLoadSubRowsFor === undefined) {
        setPageCount(Math.ceil(totalCount / pageSize))
        setTotalRowCount(totalCount)
      }
    }

    fetchData().catch(console.error)
  }, [pagination, subRowToLoadMore, grouping, expanded])

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

  const onLoadMoreSubRows = useCallback(
    (rowId: RowId, skip: number) => {
      setSubRowToLoadMore({ rowId, skip })
    },
    [setSubRowToLoadMore],
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

  const onSelectedRowChange = useCallback(
    (updater: Updater<RowSelectionState>) => {
      const newSelectedRows = updaterToValue(updater, selectedRows)
      setSelectedRows(newSelectedRows)
    },
    [setSelectedRows, selectedRows],
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

  // TODO: Refactor and use Tanstack column pinning?
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
    onRowSelectionChange: onSelectedRowChange,

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

  const topLevelRows = table.getRowModel().rows.filter((row) => row.depth === 0)
  return (
    <>
      <JobsTableActionBar
        allColumns={allColumns}
        groupedColumns={grouping}
        selectedJobs={selectedJobs} // TODO: This may need to be change to reflect that queues/jobsets can be selected (e.g. to cancel all within)
        onColumnsChanged={setAllColumns}
        onGroupsChanged={onGroupingChange}
      />
      <TableContainer component={Paper}>
        <Table sx={{ tableLayout: "auto" }}>
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

          <JobsTableBody
            dataIsLoading={isLoading}
            columns={selectedColumnDefs}
            topLevelRows={topLevelRows}
            onLoadMoreSubRows={onLoadMoreSubRows}
          />

          <TableFooter>
            <TableRow>
              <TablePagination
                rowsPerPageOptions={[3, 10, 20, 30, 40, 50]}
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

      {debug && <pre>{JSON.stringify(table.getState(), null, 2)}</pre>}
    </>
  )
}

interface JobsTableBodyProps {
  dataIsLoading: boolean
  columns: ColumnDef<JobTableRow>[]
  topLevelRows: Row<JobTableRow>[]
  onLoadMoreSubRows: (rowId: RowId, skip: number) => void
}
const JobsTableBody = ({ dataIsLoading, columns, topLevelRows, onLoadMoreSubRows }: JobsTableBodyProps) => {
  const canDisplay = !dataIsLoading && topLevelRows.length > 0
  return (
    <TableBody>
      {!canDisplay && (
        <TableRow>
          {dataIsLoading && (
            <TableCell colSpan={columns.length}>
              <CircularProgress />
            </TableCell>
          )}
          {!dataIsLoading && topLevelRows.length === 0 && (
            <TableCell colSpan={columns.length}>There is no data to display</TableCell>
          )}
        </TableRow>
      )}

      {topLevelRows.map((row) => recursiveRowRender(row, onLoadMoreSubRows))}
    </TableBody>
  )
}

const recursiveRowRender = (
  row: Row<JobTableRow>,
  onLoadMoreSubRows: (rowId: RowId, skip: number) => void,
): JSX.Element => {
  const original = row.original
  const rowIsGroup = isJobGroupRow(original)
  const rowCells = row.getVisibleCells()

  const depthGaugeLevelThicknessPixels = 6

  return (
    <React.Fragment key={`${row.id}_d${row.depth}`}>
      {/* Render the current row */}
      <TableRow aria-label={row.id} hover className={styles.rowDepthIndicator} sx={{ backgroundSize: row.depth * 6 }}>
        {rowCells.map((cell) => (
          <BodyCell
            cell={cell}
            rowIsGroup={rowIsGroup}
            rowIsExpanded={row.getIsExpanded()}
            onExpandedChange={row.toggleExpanded}
            subCount={rowIsGroup ? original.jobCount : undefined}
            key={cell.id}
          />
        ))}
      </TableRow>

      {/* Render any sub rows if expanded */}
      {rowIsGroup && row.getIsExpanded() && row.subRows.map((row) => recursiveRowRender(row, onLoadMoreSubRows))}

      {/* Render pagination tools for this expanded row */}
      {rowIsGroup && row.getIsExpanded() && (original.subRowCount ?? 0) > original.subRows.length && (
        <TableRow
          className={[styles.rowDepthIndicator, styles.loadMoreRow].join(" ")}
          sx={{ backgroundSize: (row.depth + 1) * depthGaugeLevelThicknessPixels }}
        >
          <TableCell colSpan={row.getVisibleCells().length} align="center" size="small">
            <Button
              size="small"
              variant="text"
              onClick={() => onLoadMoreSubRows(row.id as RowId, original.subRows.length)}
            >
              Load more
            </Button>
          </TableCell>
        </TableRow>
      )}
    </React.Fragment>
  )
}
