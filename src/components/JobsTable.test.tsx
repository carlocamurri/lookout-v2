import React from "react"
import { expect, jest } from "@jest/globals"
import { render, within, waitFor, waitForElementToBeRemoved } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Job } from "model"
import { DEFAULT_COLUMNS } from "pages/JobsPage"
import GetJobsService from "services/GetJobsService"
import GroupJobsService from "services/GroupJobsService"
import FakeGetJobsService from "services/mocks/FakeGetJobsService"
import FakeGroupJobsService from "services/mocks/FakeGroupJobsService"
import { makeTestJobs } from "utils"
import { JobsTable } from "./JobsTable"

describe("JobsTable", () => {
  let jobs: Job[], getJobsService: GetJobsService, groupJobsService: GroupJobsService

  beforeEach(() => {
    jobs = makeTestJobs(5, 1)
    getJobsService = new FakeGetJobsService(jobs)
    groupJobsService = new FakeGroupJobsService(jobs)
  })

  const renderComponent = () =>
    render(
      <JobsTable
        getJobsService={getJobsService}
        groupJobsService={groupJobsService}
        selectedColumns={DEFAULT_COLUMNS}
      />,
    )

  it("should render a spinner while loading initially", async () => {
    getJobsService.getJobs = jest.fn(() => new Promise(() => undefined))
    const { findByRole } = renderComponent()
    await findByRole("progressbar")
  })

  it("should handle no data", async () => {
    getJobsService.getJobs = jest.fn(() =>
      Promise.resolve({
        jobs: [],
        totalJobs: 0,
      }),
    )
    const { findByText, getByRole } = renderComponent()
    await waitForElementToBeRemoved(() => getByRole("progressbar"))

    await findByText("There is no data to display")
    await findByText("0 Rows")
  })

  it("should show jobs by default", async () => {
    const { findByRole, findAllByRole, getByRole } = renderComponent()
    await waitForElementToBeRemoved(() => getByRole("progressbar"))

    // Check all details for the first job are shown
    const jobToSearchFor = jobs[0]
    const matchingRow = await findByRole("row", { name: "job:" + jobToSearchFor.jobId })
    DEFAULT_COLUMNS.forEach((col) => {
      const expectedText = jobToSearchFor[col.key as keyof Job]
      within(matchingRow).getByText(expectedText!.toString()) // eslint-disable-line @typescript-eslint/no-non-null-assertion
    })

    await assertNumDataRowsShown(jobs.length, findAllByRole)
  })

  it.each([
    ["Job Set", "jobSet"],
    ["Queue", "queue"],
    ["State", "state"],
  ])("should allow grouping by %s", async (displayString, groupKey) => {
    const jobObjKey = groupKey as keyof Job

    const numQueues = 2
    const numJobSets = 3
    jobs = makeTestJobs(5, 1, numQueues, numJobSets)
    getJobsService = new FakeGetJobsService(jobs)
    groupJobsService = new FakeGroupJobsService(jobs)

    const numUniqueForJobKey = new Set(jobs.map((j) => j[jobObjKey])).size

    const { findByText, findAllByRole, getByRole } = renderComponent()
    await waitForElementToBeRemoved(() => getByRole("progressbar"))

    await groupByHeader(displayString, findByText)

    // Check number of rendered rows has changed
    await assertNumDataRowsShown(numUniqueForJobKey, findAllByRole)

    // Expand a row
    const job = jobs[0]
    await expandRow(job[jobObjKey]!.toString(), getByRole) // eslint-disable-line @typescript-eslint/no-non-null-assertion

    // Check the row right number of rows is being shown
    const numShownJobs = jobs.filter((j) => j[jobObjKey] === job[jobObjKey]).length
    await assertNumDataRowsShown(numUniqueForJobKey + numShownJobs, findAllByRole)
  })

  it("should allow 2 level grouping", async () => {
    const numQueues = 2
    const numJobSets = 3
    jobs = makeTestJobs(6, 1, numQueues, numJobSets)
    getJobsService = new FakeGetJobsService(jobs)
    groupJobsService = new FakeGroupJobsService(jobs)

    const { findByText, findAllByRole, getByRole } = renderComponent()
    await waitForElementToBeRemoved(() => getByRole("progressbar"))

    // Group to both levels
    await groupByHeader("Queue", findByText)
    await groupByHeader("Job Set", findByText)
    await assertNumDataRowsShown(numQueues, findAllByRole)

    const job = jobs[1] // Pick the second job as a bit of variation

    // Expand the first level
    await expandRow(job.queue, getByRole)
    await assertNumDataRowsShown(numQueues + numJobSets, findAllByRole)

    // Expand the second level
    await expandRow(job.jobSet, getByRole)
    await assertNumDataRowsShown(numQueues + numJobSets + 1, findAllByRole)
  })

  it("should allow 3 level grouping", async () => {
    const numQueues = 2
    const numJobSets = 3
    jobs = makeTestJobs(1000, 1, numQueues, numJobSets)
    getJobsService = new FakeGetJobsService(jobs)
    groupJobsService = new FakeGroupJobsService(jobs)

    const numStates = new Set(jobs.map((j) => j.state)).size

    const { findByText, findAllByRole, getByRole } = renderComponent()
    await waitForElementToBeRemoved(() => getByRole("progressbar"))

    // Group to 3 levels
    await groupByHeader("State", findByText)
    await groupByHeader("Job Set", findByText)
    await groupByHeader("Queue", findByText)
    await assertNumDataRowsShown(numStates, findAllByRole)

    const job = jobs[0]

    // Expand the first level
    await expandRow(job.state, getByRole)
    await assertNumDataRowsShown(numStates + numJobSets, findAllByRole)

    // Expand the second level
    await expandRow(job.jobSet, getByRole)
    await assertNumDataRowsShown(numStates + numJobSets + numQueues, findAllByRole)

    // Expand the third level
    await expandRow(job.queue, getByRole)
    const numJobsExpectedToShow = jobs.filter(
      (j) => j.state === job.state && j.jobSet === job.jobSet && j.queue === job.queue,
    ).length
    await assertNumDataRowsShown(numStates + numJobSets + numQueues + numJobsExpectedToShow, findAllByRole)
  })

  async function assertNumDataRowsShown(nDataRows: number, findAllByRole: any) {
    await waitFor(async () => {
      const rows = await findAllByRole("row")
      expect(rows.length).toBe(nDataRows + 1) // One row per data row, plus the header row
    })
  }

  async function groupByHeader(header: string, findByText: any) {
    const groupButton = await within(await findByText(header)).findByRole("button")
    userEvent.click(groupButton)
  }

  async function expandRow(buttonText: string, getByRole: any) {
    const expandButton = getByRole("button", {
      name: new RegExp(buttonText),
    })
    userEvent.click(expandButton)
  }
})
