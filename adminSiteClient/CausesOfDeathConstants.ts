import { EntityName, Time } from "@ourworldindata/types"

type NumericId = number

interface BasicEntry {
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
    }
    timeRange: { start: number; end: number }
}

export interface DataJson {
    values: number[]
    variables: number[]
    years: number[]
    ageGroups: number[]
}

// export const CAUSE_OF_DEATH_INDICATOR_NAMES = [
//     "Cancers",
//     "Chronic respiratory diseases",
//     "Diabetes and kidney diseases",
//     "Diarrheal diseases",
//     "Digestive diseases",
//     "Heart diseases",
//     "HIV/AIDS",
//     "Interpersonal violence",
//     "Malaria",
//     "Maternal disorders",
//     "Neonatal disorders",
//     "Neurological disorders",
//     "Nutritional deficiencies",
//     "Other infectious diseases",
//     "Other injuries",
//     "Other non-communicable diseases",
//     "Pneumonia",
//     "Suicide",
//     "Transport injuries",
//     "Tuberculosis",
// ] as const

// export const isCauseOfDeathIndicatorName = (
//     name: string
// ): name is CauseOfDeathIndicatorName =>
//     CAUSE_OF_DEATH_INDICATOR_NAMES.includes(name as any)

// export const CAUSE_OF_DEATH_CATEGORIES = [
//     "Noncommunicable diseases",
//     "Infectious diseases",
//     "Maternal, neonatal, and nutritional disorders",
//     "Injuries",
// ] as const

const CAUSE_OF_DEATH_CATEGORY_COLORS: Record<string, string> = {
    "Noncommunicable diseases": "#074964",
    "Infectious diseases": "#A5184D",
    "Maternal, neonatal, and nutritional disorders": "#B73696",
    Injuries: "#0B9D75",
    "Neonatal disorders": "#591347",
}

export const getCategoryColor = (category?: string): string => {
    if (!category) return "#cccccc"
    return CAUSE_OF_DEATH_CATEGORY_COLORS[category] || "#cccccc"
}

// export type CauseOfDeathIndicatorName =
//     (typeof CAUSE_OF_DEATH_INDICATOR_NAMES)[number]
// export type CauseOfDeathCategory = (typeof CAUSE_OF_DEATH_CATEGORIES)[number]

export type FetchedDataRow = {
    Entity: EntityName
    Year: Time
} & Record<string, number> // CauseOfDeathIndicatorName to value mapping

export interface DataRow {
    entityName: EntityName
    year: Time
    variable: string
    description?: string
    ageGroup: string
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
