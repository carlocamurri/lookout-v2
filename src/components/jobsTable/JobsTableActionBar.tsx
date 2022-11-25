import { Divider, Button } from "@mui/material"
import ColumnSelect from "components/ColumnSelect"
import { ColumnSpec, columnSpecFor, ColumnId } from "utils/jobsTableColumns"
import styles from "./JobsTableActionBar.module.css"
import GroupBySelect from "components/GroupBySelect"
import { memo } from "react"

export interface JobsTableActionBarProps {
  allColumns: ColumnSpec[]
  groupedColumns: ColumnId[]
  onColumnsChanged: (newColumns: ColumnSpec[]) => void
  onGroupsChanged: (newGroups: ColumnId[]) => void
}
export const JobsTableActionBar = memo(
  ({ allColumns, groupedColumns, onColumnsChanged, onGroupsChanged }: JobsTableActionBarProps) => {
    function toggleColumn(key: string) {
      const newColumns = allColumns.map((col) => ({
        ...col,
        selected: col.key === key ? !col.selected : col.selected,
      }))
      onColumnsChanged(newColumns)
    }

    function addAnnotationColumn(name: string) {
      const newColumns = allColumns.concat([
        {
          ...columnSpecFor(name as ColumnId),
          isAnnotation: true,
        },
      ])
      onColumnsChanged(newColumns)
    }

    function removeAnnotationColumn(key: string) {
      const filtered = allColumns.filter((col) => !col.isAnnotation || col.key !== key)
      onColumnsChanged(filtered)
    }

    function editAnnotationColumn(key: string, newName: string) {
      const newColumns = allColumns.map((col) => ({
        ...col,
        name: col.key === key ? newName : col.name,
      }))
      onColumnsChanged(newColumns)
    }

    return (
      <div className={styles.actionBar}>
        <div className={styles.actionGroup}>
          <GroupBySelect columns={allColumns} groups={groupedColumns} onGroupsChanged={onGroupsChanged} />
        </div>

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
  },
)
