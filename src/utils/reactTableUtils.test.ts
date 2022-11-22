import { fromRowId, mergeSubRows, RowId, RowWithOptionalSubRows, toRowId } from "./reactTableUtils"

describe("ReactTableUtils", () => {
  describe("Row IDs", () => {
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
          rowId: baseRowIdExample,
          rowIdPartsPath: [{ type: "job", value: "0" }],
          rowIdPathFromRoot: ["job:0"],
        })
      })

      it("handles child row ID format", () => {
        const result = fromRowId(childRowIdExample)
        expect(result).toStrictEqual({
          rowId: childRowIdExample,
          rowIdPartsPath: [
            { type: "queue", value: "queue-2" },
            { type: "job", value: "0" },
          ],
          rowIdPathFromRoot: ["queue:queue-2", "queue:queue-2>job:0"],
        })
      })

      it("handles deeply nested row ID format", () => {
        const result = fromRowId(deeplyNestedRowIdExample)
        expect(result).toStrictEqual({
          rowId: deeplyNestedRowIdExample,
          rowIdPartsPath: [
            { type: "jobSet", value: "job-set-2" },
            { type: "queue", value: "queue-2" },
            { type: "job", value: "0" },
          ],
          rowIdPathFromRoot: [
            "jobSet:job-set-2",
            "jobSet:job-set-2>queue:queue-2",
            "jobSet:job-set-2>queue:queue-2>job:0",
          ],
        })
      })
    })
  })

  describe("mergeSubRows", () => {
    let existingData: RowWithOptionalSubRows[], newRows: RowWithOptionalSubRows[], locationForSubRows: RowId[]

    it("returns given rows if no parent path given", () => {
      existingData = [{ rowId: "fruit:apple" }]
      newRows = [{ rowId: "fruit:banana" }]
      locationForSubRows = []
      const result = mergeSubRows(existingData, newRows, locationForSubRows)
      expect(result).toStrictEqual(newRows)
    })

    it("merges in new rows at the correct location", () => {
      existingData = [
        { rowId: "fruit:apple", subRows: [] },
        { rowId: "fruit:banana", subRows: [] },
      ]
      newRows = [{ rowId: "taste:delicious" }]
      locationForSubRows = ["fruit:banana"]

      const result = mergeSubRows(existingData, newRows, locationForSubRows)

      expect(result).toStrictEqual([
        { rowId: "fruit:apple", subRows: [] },
        { rowId: "fruit:banana", subRows: [{ rowId: "taste:delicious" }] },
      ])
    })

    it("does not crash if merging failed", () => {
      existingData = [
        { rowId: "fruit:apple", subRows: [] },
        { rowId: "fruit:banana", subRows: [] },
      ]
      newRows = [{ rowId: "taste:delicious" }]
      locationForSubRows = ["fruit:avocado"]

      const result = mergeSubRows(existingData, newRows, locationForSubRows)

      expect(result).toStrictEqual(existingData)
    })
  })
})
