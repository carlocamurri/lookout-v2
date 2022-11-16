import { Typography, Divider, Button, TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody, IconButton } from "@mui/material"
import { grey } from "@mui/material/colors"
import { ColumnDef, createColumnHelper, ExpandedState, flexRender, getCoreRowModel, getExpandedRowModel, getFilteredRowModel, getGroupedRowModel, getPaginationRowModel, GroupingState, PaginationState, RowSelection, useReactTable } from "@tanstack/react-table"
import { Job, JobFilter, JobGroup, JobOrder } from "model"
import React from "react"
import { useMemo, useState, useCallback } from "react"
import GetJobsService from "services/GetJobsService"
import ColumnSelect from "./ColumnSelect"
import GroupBySelect from "./GroupBySelect"
import {GroupRemove, GroupAdd, GroupAddOutlined, GroupRemoveOutlined, ExpandMore, KeyboardArrowRight} from "@mui/icons-material";
import GroupJobsService from "services/GroupJobsService"
import { skipPartiallyEmittedExpressions } from "typescript"
import { stringify } from "querystring"
import { usePrevious } from "hooks/usePrevious"


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

    // Job details
    jobId?: string
    jobSet?: string
    queue?: string
    state?: string
    cpu?: number
    memory?: string
    ephemeralStorage?: string

    // When grouped
    count?: number

    // Special field for react-table
    subRows?: JobRow[]
}

type RowKey = keyof JobRow
function jobsToRows(jobs: Job[]): JobRow[] {
    return jobs.map((job) => ({
      rowId: "job:" + job.jobId,
      jobId: job.jobId,
      jobSet: job.jobSet,
      queue: job.queue,
      state: job.state,
      cpu: job.cpu,
      memory: job.memory,
      ephemeralStorage: job.ephemeralStorage,
    }))
  }

const getJobsForSubGroup = async (getJobsService: GetJobsService, fieldToValue: Record<string, string> ): Promise<JobRow[]> => {
    const filters: JobFilter[] = Object.entries(fieldToValue)
        .map(([field, value]) => ({
            field,
            value,
            match: "exact"
        }));

    if (filters.length === 0) {
        return [];
    }
    
    // TODO: How to handle pagination when expanding something with lots of rows?
    const skip = 0;
    const take = Number.MAX_SAFE_INTEGER; // TODOs

    const order: JobOrder = { field: "jobId", direction: 'ASC' };
    const { jobs, totalJobs } = await getJobsService.getJobs(
        filters, 
        order, 
        skip, 
        take,
        undefined
    );

    return jobsToRows(jobs);
}

type JobsPageProps = {
    getJobsService: GetJobsService
    groupJobsService: GroupJobsService
    selectedColumns: ColumnSpec[]
}
export const JobsTable = ({getJobsService, groupJobsService, selectedColumns}: JobsPageProps) => {
    const rerender = React.useReducer(() => ({}), {})[1]
    const [data, setData] = React.useState<JobRow[]>([]);

    const columns = React.useMemo<ColumnDef<JobRow>[]>(
        () => {
            const cols = selectedColumns.map((c): ColumnDef<JobRow> => (
            {
                id: c.key,
                accessorKey: c.key,
                header: c.name,
                enableGrouping: c.groupable,
                aggregationFn: () => '-'
            }))
            console.log({cols});
            return cols;
        },
        [selectedColumns]
    )

    const [grouping, setGrouping] = React.useState<GroupingState>([])
    const [expanded, setExpanded] = React.useState<ExpandedState>({})
    const prevExpanded = usePrevious(expanded);

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
        async function fetchTopLevelData() {
            console.log("fetchTopLevelData")
            // TODO: Support filtering
            const filters: JobFilter[]  = [];
            
            const skip = pageIndex * pageSize;
            const take = pageSize;

            if (grouping?.length > 0) {
                // const filters: JobFilter[] = params.request.groupKeys.map((val, i) => {
                //     return {
                //       field: params.request.rowGroupCols[i].id,
                //       value: val,
                //       match: "exact",
                //     }
                //   })

                // TODO: Support multiple grouping
                const order: JobOrder = { field: 'name', direction: 'ASC' };
                const groupingField = grouping[0];
                const {groups, totalGroups} = await groupJobsService.groupJobs(
                    filters,
                    order,
                    groupingField,
                    selectedColumns.filter(c => c.groupable).map(c => c.key),
                    skip,
                    take,
                    undefined
                )
                const rows: JobRow[] = groups.map(group => ({
                    rowId: groupingField + ":" + group.name,
                    [groupingField]: group.name,

                    count: group.count,
                    // groupingColumnId: groupingField,
                    subRows: undefined // Will be set later if expanded
                }));
                setData(rows);
                setPageCount(Math.ceil(totalGroups / pageSize));
            } else {
                const order: JobOrder = { field: "jobId", direction: 'ASC' };
                const { jobs, totalJobs } = await getJobsService.getJobs(
                    filters, 
                    order, 
                    skip, 
                    take,
                    undefined
                );
                const newData = jobsToRows(jobs);
                console.log("Setting top level data:", {newData});
                setData(newData);
                setPageCount(Math.ceil(totalJobs / pageSize));
            }
        }

        fetchTopLevelData().catch(console.error);
    }, [pagination, grouping]);

    React.useEffect(() => {
        async function fetchExpandedData() {
            console.log("Expanded:", expanded);
            if (expanded === true || !expanded || Object.keys(expanded).length === 0) {
                console.warn("TODO expanded true");
                return;
            }

            const prevExpandedKeys = Object.keys(prevExpanded ?? {});
            const newlyExpanded = Object.keys(expanded)
                .filter(e => prevExpandedKeys.includes(e));

            const allNewData = await Promise.all(newlyExpanded.map(async (expandedKey) => {
                const groupingLevel = grouping.length;

                const [field, value] = expandedKey.split(":");
                const fieldsToValues = {
                    [field]: value
                };

                console.log(fieldsToValues);

                const newJobRows = await getJobsForSubGroup(getJobsService, fieldsToValues);

                console.log("New subrows:", newJobRows);
                return {
                    field,
                    value,
                    newJobRows
                };
            }));

            const newData = data.map(d => {
                // Makes an assumption about depth
                const newDataForRow = allNewData.find(f => f.field + ":" + f.value === d.rowId);
                return {
                    ...d,
                    subRows: newDataForRow ? newDataForRow.newJobRows : d.subRows
                };
            });
            
            console.log("Setting expanded data:", newData);
            setData(newData);
        }

        fetchExpandedData().catch(console.error);
    }, [expanded, prevExpanded])

    console.log("Columns:", columns);
    console.log("Data: ", data);
    console.log("Grouping: ", grouping);

    const table = useReactTable({
        data,
        columns,
        state: {
            grouping,
            expanded,
            pagination,
        },
        
        getCoreRowModel: getCoreRowModel(),
        getRowId: row => row.rowId,
        getSubRows: row => row.subRows,

        manualGrouping: false,
        onGroupingChange: setGrouping,
        // getFilteredRowModel: getFilteredRowModel(),
        // getGroupedRowModel: getGroupedRowModel(),
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
    });

    console.log("Table state:", table.getState());
    console.log("Includes queue:", table.getState().grouping?.includes("queue"));
    console.log("Table cols:", table.getAllColumns(), table.getAllColumns().map(c => ({...c, isGrouped: c.getIsGrouped()})))
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
                        // console.log("Row", row, {isGrouped: row.getIsGrouped(), groupingColumnId: row.groupingColumnId, groupingValue: row.groupingValue});
                        return (
                            <TableRow key={`${row.id}_d${row.depth}`}>
                                {row.getVisibleCells().map(cell => {
                                    // console.log("Cell", cell, {isGrouped: cell.getIsGrouped(), isAggregated: cell.getIsAggregated(), isPlaceholder: cell.getIsPlaceholder()})
                                    return (
                                        <TableCell key={cell.id}>
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
                                                        ({row.original['count']})
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
                                            ) : flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
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