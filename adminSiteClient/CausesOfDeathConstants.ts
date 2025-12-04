import { EntityName, Time } from "@ourworldindata/types"

type NumericId = number

export interface BasicEntry {
    id: NumericId
    name: string
}

export type AgeGroup = "All ages" | "Children under 5"

export type CategoryMetadata = BasicEntry
export type EntityMetadata = BasicEntry
export type VariableMetadata = BasicEntry & {
    description: string
    category: NumericId
    ageGroups: NumericId[]
}
export type AgeGroupMetadata = BasicEntry

export interface MetadataJson {
    source: string
    categories: CategoryMetadata[]
    dimensions: {
        entities: EntityMetadata[]
        variables: VariableMetadata[]
        ageGroups: AgeGroupMetadata[]
        sexes: BasicEntry[]
    }
    timeRange: { start: number; end: number }
}

export interface DataJson {
    values: number[]
    variables: number[]
    years: number[]
    ageGroups: number[]
    sexes: number[]
}

// TODO: maybe better placed in the metadata file?
const CAUSE_OF_DEATH_CATEGORY_COLORS: Record<string, string> = {
    "Non-communicable diseases": "#074964",
    "Infectious diseases": "#A5184D",
    "Maternal, neonatal and nutritional diseases": "#B73696",
    Injuries: "#0B9D75",
    "Birth disorders": "#591347",
}

export const getCategoryColor = (category?: string): string => {
    if (!category) return "#cccccc"
    return CAUSE_OF_DEATH_CATEGORY_COLORS[category] || "#cccccc"
}

export type FetchedDataRow = {
    Entity: EntityName
    Year: Time
} & Record<string, number>

export interface DataRow {
    entityName: EntityName
    year: Time
    variable: string
    description?: string
    ageGroup: string
    sex: string
    category: string
    value: number
}

export interface EnrichedDataRows extends DataRow {
    share: number
}

export interface EnrichedDataRow extends DataRow {
    category: string // CauseOfDeathCategory
}

export const COUNTRIES_WITH_DEFINITE_ARTICLE = [
    "Bahamas",
    "Gambia",
    "Maldives",
    "Netherlands",
    "Philippines",
    "Seychelles",
    "Marshall Islands",
    "Solomon Islands",
    "Comoros",
    "United Arab Emirates",
    "United States",
    "United Kingdom",
    "Czech Republic",
    "Central African Republic",
    "Dominican Republic",
    "Democratic Republic of Congo",
    "Congo",
    "Micronesia (country)",
]

export interface EnrichedDataItem {
    entityName: EntityName
    year: Time
    variable: string
    description?: string
    category?: string
    parentId?: string
    value?: number
    share?: number
}

export type TreeNode = d3.HierarchyRectangularNode<
    d3.HierarchyNode<EnrichedDataItem>
>

export interface TooltipTarget {
    nodeId: string
    variable: string
    value: number
    category?: string
}

export interface TooltipState {
    target: { node: TreeNode } | null
    position: { x: number; y: number }
}
