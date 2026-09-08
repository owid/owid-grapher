import { OwidColumnDef, stripDetailOnDemandLinks } from "@ourworldindata/utils"
import type { CoreColumn } from "@ourworldindata/core-table"
import type { GrapherValuesJson } from "@ourworldindata/types"
import { GrapherState } from "@ourworldindata/grapher"
import {
    getCitationLines,
    getDescriptionLines,
    getSourcesSection,
} from "./readmeTools.js"

/**
 * The values block is the reason this endpoint exists. A chart page describes its
 * indicator well but never states a number, so a client that doesn't run JavaScript
 * — a crawler, or an LLM agent reading the page once — has nothing of ours to quote
 * and answers from its own priors instead. These are the same values the chart shows
 * for the entities it has selected.
 */
function* getValuesSection(
    valuesByEntity: GrapherValuesJson[]
): Generator<string, void, undefined> {
    const withData = valuesByEntity.filter(
        (values) => values.startValues || values.endValues
    )
    if (withData.length === 0) return

    // Every entity is read from the same chart view, so the columns and the time
    // bounds are shared; take them from the first that has them.
    const first = withData[0]
    const columns = first.columns ?? {}
    const columnSlugs = Object.keys(columns)
    if (columnSlugs.length === 0) return

    yield ""
    yield "## Values shown in this view"

    for (const slug of columnSlugs) {
        const column = columns[slug]
        const unit = column.unit ? `, in ${column.unit}` : ""
        yield ""
        yield `**${column.name}**${unit}.`

        const startTime = first.startValues ? first.startTime : undefined
        const endTime = first.endValues ? first.endTime : undefined
        const timeHeadings = [startTime, endTime].filter(
            (time) => time !== undefined
        )
        // A chart whose start and end resolve to the same year would otherwise print
        // the same column twice under two identical headings.
        const headings = [...new Set(timeHeadings)]

        yield ""
        yield `| Entity | ${headings.join(" | ")} |`
        yield `| --- | ${headings.map(() => "---:").join(" | ")} |`

        for (const values of withData) {
            const cells = headings.map((time) => {
                const points =
                    time === values.startTime
                        ? values.startValues
                        : values.endValues
                const point = points?.y.find((p) => p.columnSlug === slug)
                return point?.formattedValue ?? ""
            })
            yield `| ${values.entityName ?? ""} | ${cells.join(" | ")} |`
        }
    }
}

function* getDataAccessSection(
    canonicalUrl: string,
    search: string
): Generator<string, void, undefined> {
    yield ""
    yield "## Get this data"
    yield ""
    yield `- Data as CSV: ${canonicalUrl}.csv${search}`
    yield `- Metadata as JSON: ${canonicalUrl}.metadata.json${search}`
    yield `- Chart image: ${canonicalUrl}.png${search}`
    yield `- Interactive chart: ${canonicalUrl}${search}`
    yield ""
    yield "Append `country=` to select entities (tilde-separated codes, e.g. `country=~USA~FRA`) and `time=` to select a range (e.g. `time=2000..2023`)."
}

function* getAboutSection(
    columns: CoreColumn[]
): Generator<string, void, undefined> {
    for (const column of columns) {
        const def = column.def as OwidColumnDef
        const description = [...getDescriptionLines(def)]
        const citation = [...getCitationLines(def, column)]
        if (description.length === 0 && citation.length === 0) continue

        yield ""
        yield `### ${column.titlePublicOrDisplayName}`
        yield* description
        yield* citation
    }
}

/**
 * An agent-facing rendering of a chart page: what the view shows, the numbers in it,
 * how to fetch the underlying data, and who to credit. Distinct from `constructReadme`,
 * which documents a downloaded data package (CSV layout, zip contents) rather than the
 * page a reader arrived at.
 */
export function constructPageMarkdown(
    grapherState: GrapherState,
    columns: CoreColumn[],
    valuesByEntity: GrapherValuesJson[],
    search: string
): string {
    const canonicalUrl = grapherState.canonicalUrl ?? ""
    // Computed columns can have neither a source nor origins; they have nothing to
    // say in the About and Sources sections.
    const columnsWithSources = columns.filter(
        (column) =>
            !!column.source.name ||
            ((column.def as OwidColumnDef).origins ?? []).length > 0
    )

    const lines: string[] = [`# ${grapherState.effectiveTitle}`]
    if (grapherState.effectiveSubtitle) {
        lines.push("", grapherState.effectiveSubtitle)
    }

    lines.push(...getValuesSection(valuesByEntity))
    lines.push(...getDataAccessSection(canonicalUrl, search))

    const about = [...getAboutSection(columnsWithSources)]
    if (about.length > 0) {
        lines.push("", "## About this data", ...about)
    }

    lines.push(...getSourcesSection(columnsWithSources))

    // Detail-on-demand links (e.g. [terawatt-hours](#dod:watt-hours)) are hover
    // tooltips on the website; here they would be dead links to a fragment that
    // doesn't exist in the document.
    return stripDetailOnDemandLinks(lines.join("\n").trim()) + "\n"
}
