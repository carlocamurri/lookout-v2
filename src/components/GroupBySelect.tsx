import React from "react"

import { Clear, DragIndicator } from "@mui/icons-material"
import { Divider, FormControl, IconButton, InputLabel, MenuItem, OutlinedInput, Select } from "@mui/material"

import styles from "./GroupBySelect.module.css"
import { ColumnSpec } from "utils/jobsTableColumns"

type GroupColumnProps = {
  columns: ColumnSpec[]
  groups: string[]
  currentlySelected: string
  onSelect: (columnKey: string) => void
  onDelete: () => void
}

type GroupBySelectProps = {
  groups: string[]
  columns: ColumnSpec[]
  onSetGroup: (columnKey: string, index: number) => void
  onDeleteGroup: (index: number) => void
}

function isGroupable(column: ColumnSpec): boolean {
  return ["queue", "jobSet", "state"].includes(column.key) || column.isAnnotation
}

function GroupColumn({ columns, groups, currentlySelected, onSelect, onDelete }: GroupColumnProps) {
  return (
    <div className={styles.groupByElement}>
      <DragIndicator style={{ marginRight: 5 }} />
      <FormControl style={{ marginRight: 5, width: 200 }} size="small">
        <InputLabel id="select-column-group">Select column</InputLabel>
        <Select
          labelId="select-column-group"
          value={currentlySelected}
          size="small"
          sx={{ height: 32 }}
          input={<OutlinedInput label="Select column" />}
        >
          {columns.map((col) => (
            <MenuItem
              key={col.key}
              value={col.key}
              disabled={groups.includes(col.key)}
              onClick={() => onSelect(col.key)}
            >
              {col.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {currentlySelected && (
        <IconButton size="small" onClick={onDelete}>
          <Clear />
        </IconButton>
      )}
    </div>
  )
}

export default function GroupBySelect({ groups, columns, onSetGroup, onDeleteGroup }: GroupBySelectProps) {
  return (
    <div className={styles.container}>
      <div style={{ paddingRight: 5 }}>Group by:</div>
      {groups.map((key, i) => (
        <>
          <GroupColumn
            key={key}
            columns={columns.filter(isGroupable)}
            groups={groups}
            currentlySelected={key}
            onSelect={(newKey) => {
              onSetGroup(newKey, i)
            }}
            onDelete={() => {
              onDeleteGroup(i)
            }}
          />
          <Divider style={{ width: 10 }} />
        </>
      ))}
      <GroupColumn
        columns={columns.filter(isGroupable)}
        groups={groups}
        currentlySelected={""}
        onSelect={(newKey) => {
          onSetGroup(newKey, groups.length)
        }}
        onDelete={() => null}
      />
    </div>
  )
}
