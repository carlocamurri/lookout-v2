import { render, waitFor } from "@testing-library/react"
import { DEFAULT_COLUMNS } from "pages/JobsPage";
import { JobsTable } from "./JobsTable"


describe('JobsTable', () => {
    it('should handle no data', async () => {
        const {getByText} = render(
            <JobsTable 
                getJobsService={{
                    getJobs: async () => ({
                        jobs: [],
                        totalJobs: 0
                    })
                }} 
                groupJobsService={{
                    groupJobs: async () => ({
                        groups: [],
                        totalGroups: 0
                    }),
                }} 
                selectedColumns={DEFAULT_COLUMNS}
            />
        );

        await waitFor(() => getByText("There is no data to display"));
        getByText("0 Rows")
    })
})