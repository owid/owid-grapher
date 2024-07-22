import { DimensionProperty } from "@ourworldindata/types"

export interface MultiDimDataPageConfigType {
    name: string
    dimensions_title: string
    common_indicator_path_prefix?: string
    dimensions: Dimension[]
    views: View[]
}

export interface Dimension {
    slug: string
    name: string
    group?: string
    description?: string
    multi_select?: boolean
    choices: Choice[]
}

export interface ChoicesEnriched {
    choices: Choice[]
    choicesBySlug: Record<string, Choice>
    choicesByGroup: Record<string, Choice[]>
}

export type DimensionEnriched = Dimension & ChoicesEnriched

export interface Choice {
    slug: string
    name: string
    description?: string
    multi_select?: boolean
}

export interface View {
    dimensions: Record<string, string> // Keys: dimension slugs, values: choice slugs
    indicator_path:
        | Record<string, DimensionProperty>
        | Array<Record<string, DimensionProperty>> // Keys: indicator path, values: dimension (e.g. x, y, color, size)
    config?: Config
}

export interface Config {
    title?: string
    subtitle?: string
}
