import React, { useCallback, useMemo, useState } from "react"

import { Button, Divider, Typography } from "@mui/material"
import { grey } from "@mui/material/colors"
import { v4 as uuidv4 } from "uuid"

import { Job, JobFilter, JobGroup } from "model"
import ColumnSelect from "components/ColumnSelect"
import GroupBySelect from "components/GroupBySelect"
import GetJobsService from "services/GetJobsService"
import GroupJobsService from "services/GroupJobsService"
import styles from "./JobsPage.module.css"
import { JobsTable } from "components/JobsTable"

const HEADING_SECTION_HEIGHT = 48

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

type Row = {
  rowId: string
  jobId?: string
  jobSet?: string
  queue?: string
  state?: string
  cpu?: string
  memory?: string
  ephemeralStorage?: string
  count?: number
}

type RowKey = keyof Row

type JobsPageProps = {
  width: number
  height: number
  getJobsService: GetJobsService
  groupJobsService: GroupJobsService
}

function jobsToRows(jobs: Job[]): Row[] {
  return jobs.map((job) => ({
    rowId: job.jobId,
    jobId: job.jobId,
    jobSet: job.jobSet,
    queue: job.queue,
    state: job.state,
    cpu: job.cpu.toString(),
    memory: job.memory,
    ephemeralStorage: job.ephemeralStorage,
  }))
}

function jobGroupsToRows(
  jobGroups: JobGroup[],
  field: string,
  previousGroupedColumns: string[],
  previousGroupedValues: string[],
): Row[] {
  return jobGroups.map((jobGroup) => {
    const row: Row = {
      rowId: jobGroup.name,
      count: jobGroup.count,
    }

    for (let i = 0; i < previousGroupedColumns.length; i++) {
      const column = previousGroupedColumns[i]
      const value = previousGroupedValues[i]
      const key = column as RowKey
      row[key] = value as never
    }

    row.rowId = previousGroupedValues.join("___") + "___" + jobGroup.name
    row[field as RowKey] = jobGroup.name as never

    return row
  })
}

// function shouldGroup(request: IServerSideGetRowsRequest): boolean {
//   return request.rowGroupCols.length > request.groupKeys.length
// }

// async function groupBy(
//   service: GroupJobsService,
//   params: IServerSideGetRowsParams,
//   skip: number,
//   take: number,
// ): Promise<void> {
//   console.log(params.request.groupKeys, params.request.rowGroupCols)
//   const groupedValues = params.request.groupKeys
//   const groupFields = params.request.rowGroupCols.map((col) => col.id)
//   if (groupFields.length === 0) {
//     console.error("error when loading groups: no groups specified")
//     params.fail()
//     return
//   }
//   let groupField = groupFields[0]
//   const previouslyGrouped = []
//   for (let i = 0; i < groupedValues.length; i++) {
//     groupField = groupFields[i + 1]
//     previouslyGrouped.push(groupedValues[i])
//   }
//   const filters = previouslyGrouped.map((val, i) => {
//     const filter: JobFilter = {
//       field: groupFields[i],
//       value: val,
//       match: "exact",
//     }
//     return filter
//   })
//   try {
//     const {groups, totalGroups} = await service.groupJobs(
//       filters,
//       { field: "count", direction: "DESC" },
//       groupField,
//       [],
//       skip,
//       take,
//       undefined,
//     )
//     params.success({
//       rowData: jobGroupsToRows(groups, groupField, groupFields, previouslyGrouped),
//       rowCount: groups.length < take ? skip + groups.length : -1,
//     })
//   } catch (e) {
//     console.error(e)
//     params.fail()
//   }
// }

// function createDatasource(getJobsService: GetJobsService, groupJobsService: GroupJobsService): IServerSideDatasource {
//   return {
//     getRows: async (params) => {
//       const skip = params.request.startRow ?? 0
//       const take = (params.request.endRow ?? skip + 100) - skip

//       if (shouldGroup(params.request)) {
//         await groupBy(groupJobsService, params, skip, take)
//         return
//       }

//       try {
//         const filters: JobFilter[] = params.request.groupKeys.map((val, i) => {
//           return {
//             field: params.request.rowGroupCols[i].id,
//             value: val,
//             match: "exact",
//           }
//         })
//         const getJobsResponse = await getJobsService.getJobs(
//           filters,
//           { field: "jobId", direction: "ASC" },
//           skip,
//           take,
//           undefined,
//         )
//         const jobs = getJobsResponse.jobs
//         params.success({
//           rowData: jobsToRows(jobs),
//           rowCount: jobs.length < take ? skip + jobs.length : -1,
//         })
//       } catch (e) {
//         console.error(e)
//         params.fail()
//       }
//     },
//   }
// }

export default function JobsPage(props: JobsPageProps) {
  const [columns, setColumns] = useState<ColumnSpec[]>(defaultColumns)

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
      key: uuidv4(),
      name: name,
      selected: true,
      isAnnotation: true,
      groupable: true,
    })
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
        width: props.width,
        height: props.height,
      }}
    >
      <div
        className={styles.header}
        style={{
          width: props.width,
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
      <JobsTable getJobsService={props.getJobsService} groupJobsService={props.groupJobsService} selectedColumns={columns} />
    </div>
  )
}
