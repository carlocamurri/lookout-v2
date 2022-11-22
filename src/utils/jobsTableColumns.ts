import { capitalize } from "lodash";
import { Job } from "model"

export type ColumnId = keyof Job;
export type ColumnSpec = {
    key: ColumnId
    name: string
    selected: boolean
    isAnnotation: boolean
    groupable: boolean
    minSize?: number;
    formatter?: (value: unknown) => string;
}

const getDefaultColumnSpec = (colId: ColumnId): ColumnSpec => ({ 
    key: colId, 
    name: capitalize(colId), 
    selected: true, 
    isAnnotation: false, 
    groupable: false,
    minSize: 30
});

const numFormatter = Intl.NumberFormat();

const COLUMN_SPECS: ColumnSpec[] = [
    { key: "jobId", name: "Job Id", selected: true, isAnnotation: false, groupable: false, minSize: 30 },
    { key: "jobSet", name: "Job Set", selected: true, isAnnotation: false, groupable: true, minSize: 100 },
    { key: "queue", name: "Queue", selected: true, isAnnotation: false, groupable: true, minSize: 95 },
    { key: "state", name: "State", selected: true, isAnnotation: false, groupable: true, minSize: 60 },
    { key: "cpu", name: "CPU", selected: true, isAnnotation: false, groupable: false, minSize: 60, formatter: cpu => numFormatter.format(Number(cpu)) },
    { key: "memory", name: "Memory", selected: true, isAnnotation: false, groupable: false, minSize: 70 },
    { key: "ephemeralStorage", name: "Eph. Storage", selected: true, isAnnotation: false, groupable: false, minSize: 95 },
  ]

export const DEFAULT_COLUMNS: ColumnId[] = [
    "jobId",
    "jobSet",
    "queue",
    "state",
    "cpu",
    "memory",
    "ephemeralStorage"
]

const COLUMN_SPEC_MAP = COLUMN_SPECS.reduce<Record<ColumnId, ColumnSpec>>((map, spec) => {
    map[spec.key] = spec;
    return map;
}, {} as Record<ColumnId, ColumnSpec>);

export const columnSpecFor = (columnId: ColumnId): ColumnSpec => COLUMN_SPEC_MAP[columnId] ?? getDefaultColumnSpec(columnId);

export const DEFAULT_COLUMN_SPECS = DEFAULT_COLUMNS.map(columnSpecFor);
