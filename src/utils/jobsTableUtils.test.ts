import { convertExpandedRowFieldsToFilters } from "./jobsTableUtils"

describe("JobsTableUtils", () => {
  describe("convertExpandedRowFieldsToFilters", () => {
    it("returns empty if not expanding a row", () => {
      const result = convertExpandedRowFieldsToFilters([])
      expect(result).toStrictEqual([])
    })

    it("returns one filter when expanding a top level row", () => {
      const result = convertExpandedRowFieldsToFilters([{ type: "queue", value: "queue-2" }])
      expect(result).toStrictEqual([
        {
          field: "queue",
          value: "queue-2",
          match: "exact",
        },
      ])
    })

    it("returns multiple filters when expanding a nested row", () => {
      const result = convertExpandedRowFieldsToFilters([
        { type: "jobSet", value: "job-set-2" },
        {
          type: "queue",
          value: "queue-2",
        },
      ])
      expect(result).toStrictEqual([
        {
          field: "jobSet",
          value: "job-set-2",
          match: "exact",
        },
        {
          field: "queue",
          value: "queue-2",
          match: "exact",
        },
      ])
    })
  })
})
