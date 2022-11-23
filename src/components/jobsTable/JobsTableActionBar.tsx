import React from 'react';
import { Typography, Divider, Button } from "@mui/material"
import ColumnSelect from "components/ColumnSelect"
import { useState } from "react"
import { ColumnSpec, DEFAULT_COLUMN_SPECS, columnSpecFor, ColumnId } from "utils/jobsTableColumns"
import styles from './JobsTableActionBar.module.css';
import GroupBySelect from 'components/GroupBySelect';

const HEADING_SECTION_HEIGHT = 48

export interface JobsTableActionBarProps {
    columns: ColumnSpec[];
    groups: ColumnId[];
    onColumnsChanged: (newColumns: ColumnSpec[]) => void;
    onGroupsChanged: (newGroups: ColumnId[]) => void;
}
export const JobsTableActionBar = ({ columns, groups, onColumnsChanged, onGroupsChanged }: JobsTableActionBarProps) => {
    // const [columns, setColumns] = useState<ColumnSpec[]>(DEFAULT_COLUMN_SPECS)

    function toggleColumn(key: string) {
        const newColumns = columns.map((col) => col)
        for (let i = 0; i < newColumns.length; i++) {
            if (newColumns[i].key === key) {
                newColumns[i].selected = !newColumns[i].selected
            }
        }
        onColumnsChanged(newColumns)
    }

    function addAnnotationColumn(name: string) {
        const newColumns = columns.map((col) => col)
        newColumns.push({
            ...columnSpecFor(name as ColumnId),
            isAnnotation: true,
        })
        onColumnsChanged(newColumns)
    }

    function removeAnnotationColumn(key: string) {
        const filtered = columns.filter((col) => col.key !== key)
        onColumnsChanged(filtered)
    }

    function editAnnotationColumn(key: string, name: string) {
        const newColumns = columns.map((col) => col)
        for (let i = 0; i < newColumns.length; i++) {
            if (newColumns[i].key === key) {
                newColumns[i].name = name
            }
        }
        onColumnsChanged(newColumns)
    }

    return (
        <div className={styles.actionBar}>
            <GroupBySelect
                columns={columns}
                groups={groups}
                onGroupsChanged={onGroupsChanged}
            />

            <div className={styles.actionGroup}>
                <ColumnSelect
                    columns={columns}
                    onAddAnnotation={addAnnotationColumn}
                    onToggleColumn={toggleColumn}
                    onEditAnnotation={editAnnotationColumn}
                    onRemoveAnnotation={removeAnnotationColumn}
                />
                <Divider
                    orientation="vertical"
                />
                <Button
                    variant="contained"
                >
                    Cancel
                </Button>
                <Button
                    variant="contained"
                >
                    Reprioritize
                </Button>
            </div>
        </div>
    )
}