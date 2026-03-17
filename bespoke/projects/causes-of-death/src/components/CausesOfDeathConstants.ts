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
    ageGroup?: NumericId[]
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

// Regions that require the definite article "the" before their name
// Maintained here instead of in the ETL because it's such a specific piece of metadata.
export const regionsWithArticle = new Set([
    "Aland Islands",
    "Netherlands Antilles",
    "United Arab Emirates",
    "French Southern Territories",
    "Bahrain",
    "Bahamas",
    "Central African Republic",
    "Cocos Islands",
    "Democratic Republic of Congo",
    "Congo",
    "Cook Islands",
    "Comoros",
    "Cayman Islands",
    "Dominican Republic",
    "Western Sahara",
    "Falkland Islands",
    "Faroe Islands",
    "United Kingdom",
    "Gambia",
    "Heard Island and McDonald Islands",
    "Isle of Man",
    "British Indian Ocean Territory",
    "Maldives",
    "Marshall Islands",
    "Northern Mariana Islands",
    "Netherlands",
    "Grand Duchy of Baden",
    "Kingdom of Bavaria",
    "Democratic Republic of Vietnam",
    "Kingdom of the Two Sicilies",
    "Duchy of Modena and Reggio",
    "Orange Free State",
    "Duchy of Parma and Piacenza",
    "Federal Republic of Central America",
    "Republic of Vietnam",
    "Kingdom of Sardinia",
    "Kingdom of Saxony",
    "Sudan (former)",
    "Grand Duchy of Tuscany",
    "USSR",
    "Kingdom of Wurttemberg",
    "Yemen Arab Republic",
    "Yemen People's Republic",
    "Philippines",
    "Gaza Strip",
    "South Georgia and the South Sandwich Islands",
    "Solomon Islands",
    "Seychelles",
    "Turks and Caicos Islands",
    "United States",
    "Vatican",
    "British Virgin Islands",
    "United States Virgin Islands",
])

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
