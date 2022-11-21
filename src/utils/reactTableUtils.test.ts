import { fromRowId, toRowId } from "./reactTableUtils"

describe("ReactTableUtils", () => {
  const baseRowIdExample = "job:0"
  const childRowIdExample = "queue:queue-2>job:0"
  const deeplyNestedRowIdExample = "jobSet:job-set-2>queue:queue-2>job:0"

  describe("toRowId", () => {
    it("returns base row ID format", () => {
      const result = toRowId({
        type: "job",
        value: "0",
      })
      expect(result).toBe(baseRowIdExample)
    })

    it("returns child row ID format", () => {
      const result = toRowId({
        type: "job",
        value: "0",
        parentRowId: "queue:queue-2",
      })
      expect(result).toBe(childRowIdExample)
    })

    it("returns deeply nested row ID format", () => {
      const result = toRowId({
        type: "job",
        value: "0",
        parentRowId: "jobSet:job-set-2>queue:queue-2",
      })
      expect(result).toBe(deeplyNestedRowIdExample)
    })
  })

  describe("fromRowId", () => {
    it("handles base row ID format", () => {
      const result = fromRowId(baseRowIdExample)
      expect(result).toStrictEqual({
        rowIdPartsPath: [{type: 'job', value: '0'}],
        rowIdPathFromRoot: ['job:0']
      })
    })

    it("handles child row ID format", () => {
      const result = fromRowId(childRowIdExample)
      expect(result).toStrictEqual({
        rowIdPartsPath: [{type: "queue", value: "queue-2"}, {type: 'job', value: '0'}],
        rowIdPathFromRoot: ["queue:queue-2", 'queue:queue-2>job:0']
      })
    })

    it("handles deeply nested row ID format", () => {
      const result = fromRowId(deeplyNestedRowIdExample)
      expect(result).toStrictEqual({
        rowIdPartsPath: [{type: "jobSet", value: "job-set-2"}, {type: "queue", value: "queue-2"}, {type: 'job', value: '0'}],
        rowIdPathFromRoot: ["jobSet:job-set-2", "jobSet:job-set-2>queue:queue-2", 'jobSet:job-set-2>queue:queue-2>job:0']
      })
    })
  })
})
