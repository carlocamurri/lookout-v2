import { Divider, Button } from "@mui/material"
import ColumnSelect from "components/ColumnSelect"
import { ColumnSpec, columnSpecFor, ColumnId } from "utils/jobsTableColumns"
import styles from "./JobsTableActionBar.module.css"
import GroupBySelect from "components/GroupBySelect"

export interface JobsTableActionBarProps {
  allColumns: ColumnSpec[]
  groupedColumns: ColumnId[]
  onColumnsChanged: (newColumns: ColumnSpec[]) => void
  onGroupsChanged: (newGroups: ColumnId[]) => void
}
export const JobsTableActionBar = ({
  allColumns,
  groupedColumns,
  onColumnsChanged,
  onGroupsChanged,
}: JobsTableActionBarProps) => {
  function toggleColumn(key: string) {
    const newColumns = allColumns.map((col) => col)
    for (let i = 0; i < newColumns.length; i++) {
      if (newColumns[i].key === key) {
        newColumns[i].selected = !newColumns[i].selected
      }
    }
    onColumnsChanged(newColumns)
  }

  function addAnnotationColumn(name: string) {
    const newColumns = allColumns.map((col) => col)
    newColumns.push({
      ...columnSpecFor(name as ColumnId),
      isAnnotation: true,
    })
    onColumnsChanged(newColumns)
  }

  function removeAnnotationColumn(key: string) {
    const filtered = allColumns.filter((col) => col.key !== key)
    onColumnsChanged(filtered)
  }

  function editAnnotationColumn(key: string, name: string) {
    const newColumns = allColumns.map((col) => col)
    for (let i = 0; i < newColumns.length; i++) {
      if (newColumns[i].key === key) {
        newColumns[i].name = name
      }
    }
    onColumnsChanged(newColumns)
  }

  return (
    <div className={styles.actionBar}>
      <GroupBySelect columns={allColumns} groups={groupedColumns} onGroupsChanged={onGroupsChanged} />

      <div className={styles.actionGroup}>
        <ColumnSelect
          allColumns={allColumns}
          groupedColumns={groupedColumns}
          onAddAnnotation={addAnnotationColumn}
          onToggleColumn={toggleColumn}
          onEditAnnotation={editAnnotationColumn}
          onRemoveAnnotation={removeAnnotationColumn}
        />
        <Divider orientation="vertical" />
        <Button variant="contained">Cancel</Button>
        <Button variant="contained">Reprioritize</Button>
      </div>
    </div>
  )
}
