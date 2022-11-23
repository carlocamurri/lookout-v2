import React, { useState } from "react"

import { Button, Divider, Typography } from "@mui/material"

import ColumnSelect from "components/ColumnSelect"
import GetJobsService from "services/GetJobsService"
import GroupJobsService from "services/GroupJobsService"
import styles from "./JobsPage.module.css"
import { JobsTable } from "components/jobsTable/JobsTable"
import { ColumnId, ColumnSpec, columnSpecFor, DEFAULT_COLUMN_SPECS } from "utils/jobsTableColumns"
import { JobsTableActionBar } from "components/jobsTable/JobsTableActionBar"


type JobsPageProps = {
  width: number
  height: number
  getJobsService: GetJobsService
  groupJobsService: GroupJobsService
}

export default function JobsPage(props: JobsPageProps) {
  return (
    <div className={styles.jobsTable}>
      <JobsTable
        getJobsService={props.getJobsService}
        groupJobsService={props.groupJobsService}
      />
    </div>
  )
}
