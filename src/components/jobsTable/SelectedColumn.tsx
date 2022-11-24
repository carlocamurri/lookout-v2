import { Checkbox } from "@mui/material";
import { ColumnDef } from "@tanstack/react-table";
import { JobTableRow } from "models/jobsTableModels";
import { ColumnId } from "utils/jobsTableColumns";

export const SELECT_COLUMN_ID: ColumnId = 'selectorCol';
export const getSelectedColumnDef = (): ColumnDef<JobTableRow> => {
    return {
        id: SELECT_COLUMN_ID,
        minSize: 5,
        size: 5,
        maxSize: 5,
        // aggregationFn: undefined,
        aggregatedCell: undefined,
        header: ({ table }) => {
            return (
                <Checkbox
                    checked={table.getIsAllRowsSelected()}
                    indeterminate={table.getIsSomeRowsSelected()}
                    onChange={table.getToggleAllRowsSelectedHandler()}
                    size="small"
                // sx={{height: "1.5em", width: "1.5em"}}
                />
            )
        },
        cell: ({ row, column }) => {
            // console.log({row, checked: row.getIsSelected(), indeterminate: row.getIsSomeSelected()})
            return (
                <Checkbox
                    checked={row.getIsGrouped() ? row.getIsAllSubRowsSelected() : row.getIsSelected()}
                    indeterminate={row.getIsSomeSelected()}
                    onChange={row.getToggleSelectedHandler()}
                    size="small"
                    sx={{
                        marginLeft: `${row.depth}em`
                    }}
                // sx={{height: "1.5em", width: "1.5em"}}
                />
            )
        },
    };
}