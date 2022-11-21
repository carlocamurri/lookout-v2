import { Job } from "model"
import { ColumnSpec } from "pages/JobsPage"
import GetJobsService from "services/GetJobsService"
import GroupJobsService from "services/GroupJobsService"
import FakeGetJobsService from "services/mocks/FakeGetJobsService"
import FakeGroupJobsService from "services/mocks/FakeGroupJobsService"
import { makeTestJobs } from "utils"
import { fetchAndMergeNewRows, JobTableRow } from "./jobsTableUtils"

describe("JobsTableUtils", () => {
  let jobs: Job[], getJobsService: GetJobsService, groupJobsService: GroupJobsService

  beforeEach(() => {
    jobs = makeTestJobs(5, 1)
    getJobsService = new FakeGetJobsService(jobs)
    groupJobsService = new FakeGroupJobsService(jobs)
  })

  describe("fetchAndMergeNewRows", () => {
    it("retrieves jobs", async () => {
      const rowRequest = {
        parentRowId: undefined,
        skip: 0,
        take: 2,
      }

      const existingData: JobTableRow[] = []
      const aggregatableColumns: ColumnSpec[] = []
      const groupedColumns: string[] = []

      const result = await fetchAndMergeNewRows(
        rowRequest,
        existingData,
        getJobsService,
        groupJobsService,
        aggregatableColumns,
        groupedColumns,
      )

      expect(result).toStrictEqual({
        rows: [
          {
            rowId: "job:0",
            jobId: "0",
            cpu: 4000,
            ephemeralStorage: "32Gi",
            jobSet: "job-set-1",
            memory: "24Gi",
            queue: "queue-1",
            state: "Failed",
          },
          {
            rowId: "job:1",
            jobId: "1",
            cpu: 4000,
            ephemeralStorage: "32Gi",
            jobSet: "job-set-2",
            memory: "24Gi",
            queue: "queue-2",
            state: "Queued",
          },
        ],
        updatedRootCount: 5,
      })
    })

    it("retrieves groups", async () => {
      const rowRequest = {
        parentRowId: undefined,
        skip: 0,
        take: 2,
      }

      const existingData: JobTableRow[] = []
      const aggregatableColumns: ColumnSpec[] = []
      const groupedColumns: string[] = ["queue"]

      const result = await fetchAndMergeNewRows(
        rowRequest,
        existingData,
        getJobsService,
        groupJobsService,
        aggregatableColumns,
        groupedColumns,
      )

      expect(result).toStrictEqual({
        rows: [
          { rowId: "queue:queue-1", queue: "queue-1", count: 1, isGroup: true, subRows: [] },
          { rowId: "queue:queue-2", queue: "queue-2", count: 1, isGroup: true, subRows: [] },
        ],
        updatedRootCount: 5,
      })
    })

    it("retrieves and merges jobs for expanded groups", async () => {
      const rowRequest = {
        parentRowId: "queue:queue-2",
        skip: 0,
        take: 2,
      }

      const existingData = [
        { rowId: "queue:queue-1", queue: "queue-1", count: 1, isGroup: true, subRows: [] },
        { rowId: "queue:queue-2", queue: "queue-2", count: 1, isGroup: true, subRows: [] },
      ]
      const aggregatableColumns: ColumnSpec[] = []
      const groupedColumns: string[] = ["queue"]

      const result = await fetchAndMergeNewRows(
        rowRequest,
        existingData,
        getJobsService,
        groupJobsService,
        aggregatableColumns,
        groupedColumns,
      )

      expect(result).toStrictEqual({
        rows: [
          { rowId: "queue:queue-1", queue: "queue-1", count: 1, isGroup: true, subRows: [] },
          {
            rowId: "queue:queue-2",
            queue: "queue-2",
            count: 1,
            isGroup: true,
            subRows: [
              {
                rowId: "job:1",
                jobId: "1",
                cpu: 4000,
                ephemeralStorage: "32Gi",
                jobSet: "job-set-2",
                memory: "24Gi",
                queue: "queue-2",
                state: "Queued",
              },
            ],
          },
        ],
        updatedRootCount: undefined,
      })
    })

    it("retrieves and merges groups for expanded multi-level groups", async () => {
      const rowRequest = {
        parentRowId: "queue:queue-2",
        skip: 0,
        take: 2,
      }

      const existingData = [
        { rowId: "queue:queue-1", queue: "queue-1", count: 1, isGroup: true, subRows: [] },
        { rowId: "queue:queue-2", queue: "queue-2", count: 1, isGroup: true, subRows: [] },
      ]
      const aggregatableColumns: ColumnSpec[] = []
      const groupedColumns: string[] = ["queue", "jobSet"]

      const result = await fetchAndMergeNewRows(
        rowRequest,
        existingData,
        getJobsService,
        groupJobsService,
        aggregatableColumns,
        groupedColumns,
      )

      expect(result).toStrictEqual({
        rows: [
          { rowId: "queue:queue-1", queue: "queue-1", count: 1, isGroup: true, subRows: [] },
          {
            rowId: "queue:queue-2",
            queue: "queue-2",
            count: 1,
            isGroup: true,
            subRows: [
              { rowId: "queue:queue-2>jobSet:job-set-2", jobSet: "job-set-2", count: 1, isGroup: true, subRows: [] },
            ],
          },
        ],
        updatedRootCount: undefined,
      })
    })
  })
})
