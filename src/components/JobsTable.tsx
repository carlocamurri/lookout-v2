import { Typography, Divider, Button, TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody, IconButton } from "@mui/material"
import { grey } from "@mui/material/colors"
import { ColumnDef, flexRender, getCoreRowModel, getExpandedRowModel, getFilteredRowModel, getGroupedRowModel, getPaginationRowModel, GroupingState, PaginationState, useReactTable } from "@tanstack/react-table"
import { ColDef } from "ag-grid-community"
import { AgGridReact } from "ag-grid-react"
import { Job, JobFilter } from "model"
import React from "react"
import { useMemo, useState, useCallback } from "react"
import GetJobsService from "services/GetJobsService"
import ColumnSelect from "./ColumnSelect"
import GroupBySelect from "./GroupBySelect"
import {GroupRemove, GroupAdd, GroupAddOutlined, GroupRemoveOutlined, ExpandMore, KeyboardArrowRight} from "@mui/icons-material";

const defaultColumns: ColumnSpec[] = [
    { key: "jobId", name: "Job Id", selected: true, isAnnotation: false, groupable: false },
    { key: "jobSet", name: "Job Set", selected: true, isAnnotation: false, groupable: true },
    { key: "queue", name: "Queue", selected: true, isAnnotation: false, groupable: true },
    { key: "state", name: "State", selected: true, isAnnotation: false, groupable: true },
    { key: "cpu", name: "CPU", selected: true, isAnnotation: false, groupable: false },
    { key: "memory", name: "Memory", selected: true, isAnnotation: false, groupable: false },
    { key: "ephemeralStorage", name: "Ephemeral Storage", selected: true, isAnnotation: false, groupable: false },
]

export type ColumnSpec = {
    key: string
    name: string
    selected: boolean
    isAnnotation: boolean
    groupable: boolean
}

type JobRow = {
    rowId: string
    jobId?: string
    jobSet?: string
    queue?: string
    state?: string
    cpu?: number
    memory?: string
    ephemeralStorage?: string
    count?: number
}

type RowKey = keyof JobRow
function jobsToRows(jobs: Job[]): JobRow[] {
    return jobs.map((job) => ({
      rowId: job.jobId,
      jobId: job.jobId,
      jobSet: job.jobSet,
      queue: job.queue,
      state: job.state,
      cpu: job.cpu,
      memory: job.memory,
      ephemeralStorage: job.ephemeralStorage,
    }))
  }

type JobsPageProps = {
    width: number
    height: number
    getJobsService: GetJobsService
    // groupJobsService: GroupJobsService
}
export const JobsTable = ({getJobsService, width, height}: JobsPageProps) => {
    const rerender = React.useReducer(() => ({}), {})[1]
    const [data, setData] = React.useState<JobRow[]>([]);

    const columns = React.useMemo<ColumnDef<JobRow>[]>(
        () => [
            {
                accessorFn: row => row.jobId,
                header: 'Job ID',
                aggregationFn: () => '-',
            },
            {
                accessorFn: row => row.jobSet,
                header: 'Job Set',
                aggregationFn: () => '-',
            },
            {
                accessorFn: row => row.queue,
                header: 'Queue',
                aggregationFn: () => '-',
            },
            {
                accessorFn: row => row.state,
                header: 'State',
                aggregationFn: () => '-',
            },
            {
                accessorFn: row => row.cpu,
                header: 'CPU',
                aggregationFn: 'sum',
                enableGrouping: false,
            },
            {
                accessorFn: row => row.memory,
                header: 'Memory',
                aggregationFn: () => 'TODO',
                enableGrouping: false,
            },
            {
                accessorFn: row => row.ephemeralStorage,
                header: 'Ephemeral Storage',
                aggregationFn: () => 'TODO',
                enableGrouping: false,
            },
        ],
        []
    )

    const [grouping, setGrouping] = React.useState<GroupingState>([])
    const [{ pageIndex, pageSize }, setPagination] = React.useState<PaginationState>({
      pageIndex: 0,
      pageSize: 10,
    })
    const [pageCount, setPageCount] = React.useState<number>(-1);
    const pagination = React.useMemo(
        () => ({
          pageIndex,
          pageSize,
        }),
        [pageIndex, pageSize]
      )

    React.useEffect(() => {
        async function fetchData() {
            const filters: JobFilter[]  = [];
            const skip = pageIndex * pageSize;
            const take = pageSize;
            const { jobs, totalJobs } = await getJobsService.getJobs(
                filters, 
                { field: "jobId", direction: "ASC" }, 
                skip, 
                take, 
                undefined
            );
            setData(jobsToRows(jobs));
            setPageCount(Math.ceil(totalJobs / pageSize));
        }

        fetchData().catch(console.error);
    }, [pagination]);

    const table = useReactTable({
        data,
        pageCount: pageCount,
        columns,
        state: {
            grouping,
            pagination,
        },
        manualPagination: true,
        onGroupingChange: setGrouping,
        getExpandedRowModel: getExpandedRowModel(),
        getGroupedRowModel: getGroupedRowModel(),
        getCoreRowModel: getCoreRowModel(),
        onPaginationChange: setPagination,
        getFilteredRowModel: getFilteredRowModel(),
        debugTable: true,
    });
    return (
        <TableContainer component={Paper} className="p-2">
            <div className="h-2" />
            <Table>
                <TableHead>
                    {table.getHeaderGroups().map(headerGroup => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map(header => {
                                return (
                                    <TableCell key={header.id} 
                                        // colSpan={header.colSpan}
                                    >
                                        {header.isPlaceholder ? null : (
                                            <div>
                                                {header.column.getCanGroup() ? (
                                                    // If the header can be grouped, let's add a toggle
                                                    <IconButton size="small"
                                                        {...{
                                                            onClick: header.column.getToggleGroupingHandler(),
                                                            style: {
                                                                cursor: 'pointer',
                                                            },
                                                        }}
                                                    >
                                                        {header.column.getIsGrouped()
                                                            ? <><GroupRemoveOutlined fontSize="small"/> ({header.column.getGroupedIndex()})</>
                                                            : <GroupAddOutlined fontSize="small"/>}
                                                    </IconButton>
                                                ) : null}{' '}
                                                {flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                            </div>
                                        )}
                                    </TableCell>
                                )
                            })}
                        </TableRow>
                    ))}
                </TableHead>
                <TableBody>
                    {table.getRowModel().rows.map(row => {
                        return (
                            <TableRow key={row.id}>
                                {row.getVisibleCells().map(cell => {
                                    return (
                                        <TableCell
                                            key={cell.id}
                                            {...{
                                                style: {
                                                    background: cell.getIsGrouped()
                                                        ? '#0aff0082'
                                                        : cell.getIsAggregated()
                                                            ? '#ffa50078'
                                                            : cell.getIsPlaceholder()
                                                                ? '#ff000042'
                                                                : 'white',
                                                },
                                            }}
                                        >
                                            {cell.getIsGrouped() ? (
                                                // If it's a grouped cell, add an expander and row count
                                                <>
                                                    <Button variant="text" size="small"
                                                        {...{
                                                            onClick: row.getToggleExpandedHandler(),
                                                            style: {
                                                                cursor: row.getCanExpand()
                                                                    ? 'pointer'
                                                                    : 'normal',
                                                            },
                                                        }}
                                                    >
                                                        {row.getIsExpanded() ? <ExpandMore fontSize="small"/> : <KeyboardArrowRight fontSize="small"/>}{' '}
                                                        {flexRender(
                                                            cell.column.columnDef.cell,
                                                            cell.getContext()
                                                        )}{' '}
                                                        ({row.subRows.length})
                                                    </Button>
                                                </>
                                            ) : cell.getIsAggregated() ? (
                                                // If the cell is aggregated, use the Aggregated
                                                // renderer for cell
                                                flexRender(
                                                    cell.column.columnDef.aggregatedCell ??
                                                    cell.column.columnDef.cell,
                                                    cell.getContext()
                                                )
                                            ) : cell.getIsPlaceholder() ? null : ( // For cells with repeated values, render null
                                                // Otherwise, just render the regular cell
                                                flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext()
                                                )
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
                    {'<<'}
                </button>
                <button
                    className="border rounded p-1"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                >
                    {'<'}
                </button>
                <button
                    className="border rounded p-1"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                >
                    {'>'}
                </button>
                <button
                    className="border rounded p-1"
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                >
                    {'>>'}
                </button>
                <span className="flex items-center gap-1">
                    <div>Page</div>
                    <strong>
                        {table.getState().pagination.pageIndex + 1} of{' '}
                        {table.getPageCount()}
                    </strong>
                </span>
                <span className="flex items-center gap-1">
                    | Go to page:
                    <input
                        type="number"
                        defaultValue={table.getState().pagination.pageIndex + 1}
                        onChange={e => {
                            const page = e.target.value ? Number(e.target.value) - 1 : 0
                            table.setPageIndex(page)
                        }}
                        className="border p-1 rounded w-16"
                    />
                </span>
                <select
                    value={table.getState().pagination.pageSize}
                    onChange={e => {
                        table.setPageSize(Number(e.target.value))
                    }}
                >
                    {[10, 20, 30, 40, 50].map(pageSize => (
                        <option key={pageSize} value={pageSize}>
                            Show {pageSize}
                        </option>
                    ))}
                </select>
            </div>
            <div>{table.getRowModel().rows.length} Rows</div>
            <div>
                <button onClick={() => rerender()}>Force Rerender</button>
            </div>
            <div>
                {/* <button onClick={() => refreshData()}>Refresh Data</button> */}
            </div>
            <pre>{JSON.stringify(grouping, null, 2)}</pre>
        </TableContainer>
    );
}