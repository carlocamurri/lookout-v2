import { Job, JobFilter, JobGroup, JobOrder } from "model"
import { GetJobsService } from "services/GetJobsService"
import { GroupJobsService } from "services/GroupJobsService"

const DEFAULT_ORDER: JobOrder = {
  direction: "DESC",
  field: "count",
}

const DEFAULT_JOB_ORDER: JobOrder = {
  direction: "ASC",
  field: "jobId",
}

type TreeNode = {
  field: string
  value: string
  count: number
  parent?: TreeNode
  aggregates: Record<string, string | number>
  children: TreeNode[]
  isLeaf: boolean
  job?: Job
}

interface Tree {
  getGroupedFields(): string[]
  setGroupedField(field: string, index: number): void
  deleteGroupedField(index: number): void
  loadGroup(groupValues: string[], newField: string): Promise<void>
  getGroups(groupValues: string[]): JobGroup[]
  getLeaves(groupValues: string[]): Job[]
}

function jobGroupToNode(field: string, jobGroup: JobGroup): TreeNode {
  return {
    field: field,
    value: jobGroup.name,
    count: jobGroup.count,
    aggregates: jobGroup.aggregates,
    children: [],
    isLeaf: false,
  }
}

function nodeToJobGroup(node: TreeNode): JobGroup {
  return {
    name: node.value,
    count: node.count,
    aggregates: node.aggregates,
  }
}

export class GroupTree implements Tree {
  private groupJobsService: GroupJobsService
  private getJobsService: GetJobsService

  private root: TreeNode
  private groupedFields: string[]

  constructor(groupJobsService: GroupJobsService, getJobsService: GetJobsService) {
    this.groupJobsService = groupJobsService
    this.getJobsService = getJobsService
    this.root = {
      field: "*",
      value: "*",
      count: 0,
      aggregates: {},
      children: [],
      isLeaf: false,
    }
    this.groupedFields = []
  }

  deleteGroupedField(index: number): void {
    if (index < 0 || index >= this.groupedFields.length) {
      return
    }

    const newGroupedFields = Array.from(this.groupedFields)
    newGroupedFields.splice(index, 1)
    this.groupedFields = newGroupedFields
    this.root = {
      field: "*",
      value: "*",
      count: 0,
      aggregates: {},
      children: [],
      isLeaf: false,
    }
  }

  getGroups(groupValues: string[]): JobGroup[] {
    // Traverse the tree until you find the correct node
    let it = this.root
    for (let i = 0; i < groupValues.length; i++) {
      const currentGroupValue = groupValues[i]
      const child = this.findNode(it.children, currentGroupValue)
      if (child === undefined) {
        return []
      }
      it = child
    }
    return it.children.map(nodeToJobGroup)
  }

  getLeaves(groupValues: string[]): Job[] {
    throw new Error("Method not implemented.")
  }

  getGroupedFields(): string[] {
    return this.groupedFields
  }

  setGroupedField(field: string, index: number) {
    if (index > this.groupedFields.length || index < 0) {
      return
    }

    const newGroups = Array.from(this.groupedFields)
    if (index >= this.groupedFields.length) {
      newGroups.push(field)
    } else {
      newGroups[index] = field
    }
    this.groupedFields = newGroups
    this.root = {
      field: "*",
      value: "*",
      count: 0,
      aggregates: {},
      children: [],
      isLeaf: false,
    }
  }

  async loadGroup(groupValues: string[], newField: string): Promise<void> {
    if (this.groupedFields.length < groupValues.length + 1) {
      return
    }

    // Start traversal
    let it = this.root
    for (let i = 0; i < groupValues.length; i++) {
      const currentGroupValue = groupValues[i]
      let child = this.findNode(it.children, currentGroupValue)
      if (child === undefined) {
        const previousGroupValues = groupValues.slice(0, i)
        const currentField = this.groupedFields[i]
        if (await this.groupCanBeLoaded(groupValues.slice(0, i + 1))) {
          const groups = await this.fetchGroupsIncluding(previousGroupValues, currentField, currentGroupValue)
          it.children = groups.map((group) => jobGroupToNode(currentField, group))
          child = this.findNode(it.children, currentGroupValue)
        }
      }

      // If the child is still undefined, we return
      if (child === undefined) {
        console.warn(`child of group by ${it.field} node ${it.value} not found`)
        return
      }

      it = child
    }

    // `it` is now node below which new groups need to be loaded
    if (this.groupedFields[this.groupedFields.length - 1] === newField && it.children.length === 0) {
      const groups = await this.fetchGroups(groupValues, newField, 0, 100)
      it.children = groups.map((jobGroup) => jobGroupToNode(newField, jobGroup))
    }
  }

  findNode(children: TreeNode[], groupValue: string): TreeNode | undefined {
    return children.find((node) => node.value === groupValue)
  }

  async groupCanBeLoaded(groupValues: string[]): Promise<boolean> {
    const jobs = await this.getJobsService.getJobs(
      this.filtersForGroupValues(groupValues),
      DEFAULT_JOB_ORDER,
      0,
      1,
      undefined,
    )
    return jobs.length > 0
  }

  // Group by field, filtering by previous groupValues, ensuring that ensureGroupValue is one of the groups returned
  private async fetchGroupsIncluding(
    groupValues: string[],
    field: string,
    ensureGroupValue: string,
  ): Promise<JobGroup[]> {
    const loaded: JobGroup[] = []
    let shouldLoad = true
    let idx = 0
    const batchSize = 100
    while (shouldLoad) {
      const current = await this.fetchGroups(groupValues, field, idx, batchSize)
      for (const group of current) {
        if (group.name === ensureGroupValue) {
          shouldLoad = false
        }
      }
      loaded.push(...current)
      idx += batchSize
    }
    return loaded
  }

  private async fetchGroups(groupValues: string[], field: string, skip: number, take: number): Promise<JobGroup[]> {
    const vals = await this.groupJobsService.groupJobs(
      this.filtersForGroupValues(groupValues),
      DEFAULT_ORDER,
      field,
      [],
      skip,
      take,
      undefined,
    )
    return vals
  }

  private filtersForGroupValues(groupValues: string[]): JobFilter[] {
    return groupValues.map((val, index) => ({
      field: this.groupedFields[index],
      value: val,
      match: "exact",
    }))
  }
}
