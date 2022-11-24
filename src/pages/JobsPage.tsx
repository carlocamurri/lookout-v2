import GetJobsService from "services/GetJobsService"
import GroupJobsService from "services/GroupJobsService"
import styles from "./JobsPage.module.css"
import { JobsTable } from "components/jobsTable/JobsTable"

type JobsPageProps = {
  width: number
  height: number
  getJobsService: GetJobsService
  groupJobsService: GroupJobsService
}

export default function JobsPage(props: JobsPageProps) {
  return (
    <div className={styles.jobsTable}>
      <JobsTable getJobsService={props.getJobsService} groupJobsService={props.groupJobsService} />
    </div>
  )
}
