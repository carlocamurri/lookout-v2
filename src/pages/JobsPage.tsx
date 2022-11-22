import React, { useState } from "react"

import { Button, Divider, Typography } from "@mui/material"
import { v4 as uuidv4 } from "uuid"

import ColumnSelect from "components/ColumnSelect"
import GetJobsService from "services/GetJobsService"
import GroupJobsService from "services/GroupJobsService"
import styles from "./JobsPage.module.css"
import { JobsTable } from "components/JobsTable"
import { ColumnId, ColumnSpec, columnSpecFor, DEFAULT_COLUMN_SPECS } from "utils/jobsTableColumns"

const HEADING_SECTION_HEIGHT = 48

type JobsPageProps = {
  width: number
  height: number
  getJobsService: GetJobsService
  groupJobsService: GroupJobsService
}

export default function JobsPage(props: JobsPageProps) {
  const [columns, setColumns] = useState<ColumnSpec[]>(DEFAULT_COLUMN_SPECS)

  function toggleColumn(key: string) {
    const newColumns = columns.map((col) => col)
    for (let i = 0; i < newColumns.length; i++) {
      if (newColumns[i].key === key) {
        newColumns[i].selected = !newColumns[i].selected
      }
    }
    setColumns(newColumns)
  }

  function addAnnotationColumn(name: string) {
    const newColumns = columns.map((col) => col)
    newColumns.push({
      ...columnSpecFor(name as ColumnId),
      isAnnotation: true
    });
    setColumns(newColumns)
  }

  function removeAnnotationColumn(key: string) {
    const filtered = columns.filter((col) => col.key !== key)
    setColumns(filtered)
  }

  function editAnnotationColumn(key: string, name: string) {
    const newColumns = columns.map((col) => col)
    for (let i = 0; i < newColumns.length; i++) {
      if (newColumns[i].key === key) {
        newColumns[i].name = name
      }
    }
    setColumns(newColumns)
  }

  return (
    <div
      className={styles.container}
      style={{
        width: "100%"
      }}
    >
      <div
        className={styles.header}
        style={{
          width: "100%",
          height: HEADING_SECTION_HEIGHT,
        }}
      >
        <Typography
          variant="h4"
          sx={{
            marginLeft: 1,
          }}
        >
          Jobs
        </Typography>
        <div className={styles.actions}>
          <div className={styles.actionItem}>
            <ColumnSelect
              height={HEADING_SECTION_HEIGHT - 16}
              columns={columns}
              onAddAnnotation={addAnnotationColumn}
              onToggleColumn={toggleColumn}
              onEditAnnotation={editAnnotationColumn}
              onRemoveAnnotation={removeAnnotationColumn}
            />
          </div>
          <div className={styles.actionItem}>
            <Divider
              orientation="vertical"
              sx={{
                height: HEADING_SECTION_HEIGHT - 16,
              }}
              className={styles.actionItem}
            />
          </div>
          <div className={styles.actionItem}>
            <Button
              sx={{
                maxHeight: HEADING_SECTION_HEIGHT - 16,
              }}
              className={styles.actionItem}
              variant="contained"
            >
              Cancel
            </Button>
          </div>
          <div className={styles.actionItem}>
            <Button
              sx={{
                maxHeight: HEADING_SECTION_HEIGHT - 16,
              }}
              className={styles.actionItem}
              variant="contained"
            >
              Reprioritize
            </Button>
          </div>
        </div>
      </div>
      <JobsTable
        getJobsService={props.getJobsService}
        groupJobsService={props.groupJobsService}
        selectedColumns={columns}
      />
    </div>
  )
}
