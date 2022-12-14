import { render, within, waitFor, waitForElementToBeRemoved, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Job } from "model"
import GetJobsService from "services/GetJobsService"
import GroupJobsService from "services/GroupJobsService"
import FakeGetJobsService from "services/mocks/FakeGetJobsService"
import FakeGroupJobsService from "services/mocks/FakeGroupJobsService"
import { makeTestJobs } from "utils"
import { JobsTable } from "./JobsTable"
import { DEFAULT_COLUMN_SPECS } from "utils/jobsTableColumns"

describe("JobsTable", () => {
  const numJobs = 5,
    numQueues = 2,
    numJobSets = 3
  let jobs: Job[], getJobsService: GetJobsService, groupJobsService: GroupJobsService

  beforeEach(() => {
    jobs = makeTestJobs(numJobs, 1, numQueues, numJobSets)
    getJobsService = new FakeGetJobsService(jobs)
    groupJobsService = new FakeGroupJobsService(jobs)
  })

  const renderComponent = () =>
    render(<JobsTable getJobsService={getJobsService} groupJobsService={groupJobsService} debug={false} />)

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
    await findByText("0–0 of 0")
  })

  it("should show jobs by default", async () => {
    const { findByRole, getByRole } = renderComponent()
    await waitForElementToBeRemoved(() => getByRole("progressbar"))

    // Check all details for the first job are shown
    const jobToSearchFor = jobs[0]
    const matchingRow = await findByRole("row", { name: "job:" + jobToSearchFor.jobId })
    DEFAULT_COLUMN_SPECS.forEach((col) => {
      const cellValue = jobToSearchFor[col.key as keyof Job]
      const expectedText = col.formatter?.(cellValue) ?? cellValue
      within(matchingRow).getByText(expectedText!.toString()) // eslint-disable-line @typescript-eslint/no-non-null-assertion
    })

    await assertNumDataRowsShown(jobs.length)
  })

  it.each([
    ["Job Set", "jobSet"],
    ["Queue", "queue"],
    ["State", "state"],
  ])("should allow grouping by %s", async (displayString, groupKey) => {
    const jobObjKey = groupKey as keyof Job

    const numUniqueForJobKey = new Set(jobs.map((j) => j[jobObjKey])).size

    const { getByRole } = renderComponent()
    await waitForElementToBeRemoved(() => getByRole("progressbar"))

    await groupByColumn(displayString)

    // Check number of rendered rows has changed
    await assertNumDataRowsShown(numUniqueForJobKey)

    // Expand a row
    const job = jobs[0]
    await expandRow(job[jobObjKey]!.toString()) // eslint-disable-line @typescript-eslint/no-non-null-assertion

    // Check the row right number of rows is being shown
    const numShownJobs = jobs.filter((j) => j[jobObjKey] === job[jobObjKey]).length
    await assertNumDataRowsShown(numUniqueForJobKey + numShownJobs)
  })

  it("should allow 2 level grouping", async () => {
    jobs = makeTestJobs(6, 1, numQueues, numJobSets)
    getJobsService = new FakeGetJobsService(jobs)
    groupJobsService = new FakeGroupJobsService(jobs)

    const { getByRole } = renderComponent()
    await waitForElementToBeRemoved(() => getByRole("progressbar"))

    // Group to both levels
    await groupByColumn("Queue")
    await groupByColumn("Job Set")
    await assertNumDataRowsShown(numQueues)

    const job = jobs[1] // Pick the second job as a bit of variation

    // Expand the first level
    await expandRow(job.queue)
    await assertNumDataRowsShown(numQueues + numJobSets)

    // Expand the second level
    await expandRow(job.jobSet)
    await assertNumDataRowsShown(numQueues + numJobSets + 1)
  })

  it("should allow 3 level grouping", async () => {
    jobs = makeTestJobs(1000, 1, numQueues, numJobSets)
    getJobsService = new FakeGetJobsService(jobs)
    groupJobsService = new FakeGroupJobsService(jobs)

    const numStates = new Set(jobs.map((j) => j.state)).size

    const { getByRole } = renderComponent()
    await waitForElementToBeRemoved(() => getByRole("progressbar"))

    // Group to 3 levels
    await groupByColumn("State")
    await groupByColumn("Job Set")
    await groupByColumn("Queue")
    await assertNumDataRowsShown(numStates)

    const job = jobs[0]

    // Expand the first level
    await expandRow(job.state)
    await assertNumDataRowsShown(numStates + numJobSets)

    // Expand the second level
    await expandRow(job.jobSet)
    await assertNumDataRowsShown(numStates + numJobSets + numQueues)

    // Expand the third level
    await expandRow(job.queue)
    const numJobsExpectedToShow = jobs.filter(
      (j) => j.state === job.state && j.jobSet === job.jobSet && j.queue === job.queue,
    ).length
    await assertNumDataRowsShown(numStates + numJobSets + numQueues + numJobsExpectedToShow)
  })

  it("should reset currently-expanded if grouping changes", async () => {
    jobs = makeTestJobs(5, 1, numQueues, numJobSets)
    getJobsService = new FakeGetJobsService(jobs)
    groupJobsService = new FakeGroupJobsService(jobs)

    const { getByRole, queryAllByRole } = renderComponent()
    await waitForElementToBeRemoved(() => getByRole("progressbar"))

    await groupByColumn("Queue")

    // Check we're only showing one row for each queue
    await assertNumDataRowsShown(numQueues)

    // Expand a row
    const job = jobs[0]
    await expandRow(job.queue)

    // Check the row right number of rows is being shown
    const numShownJobs = jobs.filter((j) => j.queue === job.queue).length
    await assertNumDataRowsShown(numQueues + numShownJobs)

    // Assert arrow down icon is shown
    getByRole("button", { name: "Collapse row" })

    // Group by another header
    await groupByColumn("Job Set")

    // Verify all rows are now collapsed
    waitForElementToBeRemoved(() => queryAllByRole("button", { name: "Expand row" }))
  })

  it("should allow selecting of jobs", async () => {
    const { getByRole, findByRole } = renderComponent()
    await waitForElementToBeRemoved(() => getByRole("progressbar"))

    expect(await findByRole("button", { name: "Cancel" })).toBeDisabled()
    expect(await findByRole("button", { name: "Reprioritize" })).toBeDisabled()

    toggleSelectedRow(jobs[0].jobId)
    toggleSelectedRow(jobs[2].jobId)

    expect(await findByRole("button", { name: "Cancel 2 jobs" })).toBeEnabled()
    expect(await findByRole("button", { name: "Reprioritize 2 jobs" })).toBeEnabled()

    toggleSelectedRow(jobs[2].jobId)

    expect(await findByRole("button", { name: "Cancel 1 job" })).toBeEnabled()
    expect(await findByRole("button", { name: "Reprioritize 1 job" })).toBeEnabled()

    toggleSelectedRow(jobs[0].jobId)

    expect(await findByRole("button", { name: "Cancel" })).toBeDisabled()
    expect(await findByRole("button", { name: "Reprioritize" })).toBeDisabled()
  })

  it("should allow text filtering", async () => {
    const { getByRole } = renderComponent()
    await waitForElementToBeRemoved(() => getByRole("progressbar"))
    await assertNumDataRowsShown(jobs.length)

    await filterTextColumnTo("Queue", jobs[0].queue)
    await assertNumDataRowsShown(jobs.filter((j) => j.queue === jobs[0].queue).length)

    await filterTextColumnTo("Job Id", jobs[0].jobId)
    await assertNumDataRowsShown(1)

    await filterTextColumnTo("Queue", "")
    await filterTextColumnTo("Job Id", "")

    await assertNumDataRowsShown(jobs.length)
  })

  it("should allow enum filtering", async () => {
    const { getByRole } = renderComponent()
    await waitForElementToBeRemoved(() => getByRole("progressbar"))
    await assertNumDataRowsShown(jobs.length)

    await toggleEnumFilterOption("State", jobs[0].state)
    await assertNumDataRowsShown(2)

    await toggleEnumFilterOption("State", jobs[0].state)
    await assertNumDataRowsShown(jobs.length)
  })

  it("should allow sorting jobs", async () => {
    const { getAllByRole, getByRole } = renderComponent()
    await waitForElementToBeRemoved(() => getByRole("progressbar"))

    await toggleSorting("Job Id")

    await waitFor(() => {
      const rows = getAllByRole("row")
      // Skipping header and footer rows
      expect(rows[1]).toHaveTextContent("1") // Job ID
      expect(rows[rows.length - 2]).toHaveTextContent((numJobs - 1).toString())
    })

    await toggleSorting("Job Id")

    await waitFor(() => {
      const rows = getAllByRole("row")

      // Order should be reversed now
      expect(rows[1]).toHaveTextContent((numJobs - 1).toString())
      expect(rows[rows.length - 2]).toHaveTextContent("1") // Job ID
    })
  })

  // Commented out until sorting by group name is supported
  // it("should allow sorting groups", async () => {
  //   const { getAllByRole, getByRole } = renderComponent()
  //   await waitForElementToBeRemoved(() => getByRole("progressbar"))

  //   await groupByColumn("Queue")
  //   await assertNumDataRowsShown(numQueues)

  //   await toggleSorting("Queue")

  //   await waitFor(() => {
  //     const rows = getAllByRole("row")
  //     // Skipping header and footer rows
  //     expect(rows[1]).toHaveTextContent("queue-1")
  //     expect(rows[rows.length - 2]).toHaveTextContent("queue-2")
  //   })

  //   await toggleSorting("Queue")

  //   await waitFor(() => {
  //     const rows = getAllByRole("row")

  //     // Order should be reversed now
  //     expect(rows[1]).toHaveTextContent("queue-2")
  //     expect(rows[rows.length - 2]).toHaveTextContent("queue-1")
  //   })
  // })

  async function assertNumDataRowsShown(nDataRows: number) {
    await waitFor(async () => {
      const rows = await screen.findAllByRole("row")
      expect(rows.length).toBe(nDataRows + 2) // One row per data row, plus the header and footer rows
    })
  }

  async function groupByColumn(columnDisplayName: string) {
    const groupByDropdownButton = await screen.findByRole("button", { name: "Group by" })
    userEvent.click(groupByDropdownButton)

    const dropdown = await screen.findByRole("listbox")
    const colToGroup = await within(dropdown).findByText(columnDisplayName)
    userEvent.click(colToGroup)
  }

  async function expandRow(buttonText: string) {
    const rowToExpand = await screen.findByRole("row", {
      name: new RegExp(buttonText),
    })
    const expandButton = within(rowToExpand).getByRole("button", { name: "Expand row" })
    userEvent.click(expandButton)
  }

  async function toggleSelectedRow(jobId: string) {
    const matchingRow = await screen.findByRole("row", { name: "job:" + jobId })
    const checkbox = await within(matchingRow).findByRole("checkbox")
    userEvent.click(checkbox)
  }

  async function getHeaderCell(columnDisplayName: string) {
    return await screen.findByRole("columnheader", { name: columnDisplayName })
  }

  async function filterTextColumnTo(columnDisplayName: string, filterText: string) {
    const headerCell = await getHeaderCell(columnDisplayName)
    const filterInput = await within(headerCell).findByRole("textbox", { name: "Filter" })
    userEvent.clear(filterInput)
    userEvent.type(filterInput, filterText)
  }

  async function toggleEnumFilterOption(columnDisplayName: string, filterOption: string) {
    const headerCell = await getHeaderCell(columnDisplayName)
    const dropdownTrigger = await within(headerCell).findByRole("button", { name: "Filter" })
    userEvent.click(dropdownTrigger)
    const optionButton = await screen.findByRole("option", { name: filterOption })
    userEvent.click(optionButton)

    // Ensure the dropdown is closed
    userEvent.tab()
  }

  async function toggleSorting(columnDisplayName: string) {
    const headerCell = await getHeaderCell(columnDisplayName)
    const sortButton = await within(headerCell).findByRole("button", { name: "Toggle sort" })
    userEvent.click(sortButton)
  }
})
