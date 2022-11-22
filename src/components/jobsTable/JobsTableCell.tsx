import React from "react"
import { GroupRemoveOutlined, GroupAddOutlined, KeyboardArrowRight, KeyboardArrowDown } from "@mui/icons-material"
import { TableCell, IconButton } from "@mui/material"
import { Cell, flexRender, Header } from "@tanstack/react-table"
import { JobRow } from "models/jobsTableModels"
import { ColumnId, columnSpecFor } from "utils/jobsTableColumns"

export interface HeaderCellProps {
  header: Header<JobRow, unknown>
  hoveredColumn: ColumnId | undefined
  onHoverChange: (colId?: ColumnId) => void
}
export const HeaderCell = ({ header, hoveredColumn, onHoverChange }: HeaderCellProps) => {
  const id = header.id as ColumnId
  const colSpec = columnSpecFor(id)
  const isHovered = id === hoveredColumn
  const isRightAligned = colSpec.isNumeric
  return (
    <TableCell
      key={id}
      align={isRightAligned ? "right" : "left"}
      size="small"
      sx={{
        minWidth: header.column.getSize(),
        lineHeight: "2.5em", // Provides enough height for icon buttons
        paddingLeft: "0.5em",
        paddingRight: "0.5em",
        "&:hover": {
          opacity: 0.85,
        },
      }}
      onMouseEnter={() => onHoverChange(id)}
      onMouseLeave={() => onHoverChange(undefined)}
    >
      {header.isPlaceholder ? null : (
        <>
          {flexRender(header.column.columnDef.header, header.getContext())}
          {header.column.getIsGrouped() && <> (# Jobs)</>}
          {header.column.getCanGroup() && isHovered ? (
            // If the header can be grouped, let's add a toggle
            <IconButton size="small" onClick={header.column.getToggleGroupingHandler()}>
              {header.column.getIsGrouped() ? (
                <GroupRemoveOutlined fontSize="small" aria-hidden="false" aria-label="Group By" />
              ) : (
                <GroupAddOutlined fontSize="small" aria-hidden="false" aria-label="Ungroup By" />
              )}
            </IconButton>
          ) : null}{" "}
        </>
      )}
    </TableCell>
  )
}

export interface BodyCellProps {
  cell: Cell<JobRow, unknown>
  rowIsGroup: boolean
  rowIsExpanded: boolean
  onExpandedChange: () => void
  subCount: number | undefined
}
export const BodyCell = ({ cell, rowIsGroup, rowIsExpanded, onExpandedChange, subCount }: BodyCellProps) => {
  const colId = cell.column.id as ColumnId
  const colSpec = columnSpecFor(colId)
  const cellHasValue = cell.renderValue()
  return (
    <TableCell
      key={cell.id}
      align={colSpec.isNumeric ? "right" : "left"}
      sx={{
        padding: "0.5em",
        "&:hover": {
          opacity: 0.85,
        },
      }}
    >
      {/* {rowIsGrouped && cell.column.getIsGrouped() && cellHasValue ? ( */}
      {rowIsGroup && cell.column.getIsGrouped() && cellHasValue ? (
        // If it's a grouped cell, add an expander and row count
        <>
          <IconButton size="small" edge="start" onClick={() => onExpandedChange()}>
            {rowIsExpanded ? 
                <KeyboardArrowDown fontSize="small" aria-label="Expanded" aria-hidden="false" /> : 
                <KeyboardArrowRight fontSize="small" aria-label="Collapsed" aria-hidden="false" />
            }
          </IconButton>
          {flexRender(cell.column.columnDef.cell, cell.getContext())} ({subCount})
        </>
      ) : cell.getIsAggregated() ? (
        // If the cell is aggregated, use the Aggregated
        // renderer for cell
        flexRender(cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell, cell.getContext())
      ) : (
        flexRender(cell.column.columnDef.cell, cell.getContext())
      )}
    </TableCell>
  )
}
