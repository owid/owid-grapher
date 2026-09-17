import {
    ColumnSlug,
    ColumnTypeNames,
    CoreColumnDef,
} from "@ourworldindata/types"

export const numericDefs = (...slugs: ColumnSlug[]): CoreColumnDef[] =>
    slugs.map((slug) => ({ slug, type: ColumnTypeNames.Numeric }))

export const stringDefs = (...slugs: ColumnSlug[]): CoreColumnDef[] =>
    slugs.map((slug) => ({ slug, type: ColumnTypeNames.String }))

export const yearDef = (slug: ColumnSlug = "year"): CoreColumnDef => ({
    slug,
    type: ColumnTypeNames.Year,
})
