import * as _ from "lodash-es"
import { OwidColumnDef, stripDetailOnDemandLinks } from "@ourworldindata/utils"
import type { CoreColumn } from "@ourworldindata/core-table"
import type { EntityName, GrapherValuesJson, Time } from "@ourworldindata/types"
import { GrapherState } from "@ourworldindata/grapher"
import {
    getCitationLines,
    getDescriptionLines,
    getSourcesSection,
    getTitle,
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

/**
 * The values block above covers the entities the chart selects, which is an editorial
 * choice about what to draw — on `life-expectancy` it is six world regions. It cannot
 * answer the two commonest things asked of a chart: the value for one particular
 * country, and which country is highest. This table can, for around 1,500 tokens on a
 * country-grained chart.
 *
 * Each entity is reported at its own latest time at or before the chart's end time,
 * and the year is printed whenever entities disagree, so a country whose data stops
 * early is never silently relabelled to the chart's end year.
 */
function* getAllEntityValuesSection(
    grapherState: GrapherState
): Generator<string, void, undefined> {
    const table = grapherState.tableForDownload
    const columns = grapherState.yColumnSlugs
        .filter((slug) => table.has(slug))
        .map((slug) => table.get(slug))
    if (columns.length === 0) return

    const endTime = grapherState.endTime
    const entityNames = _.uniq(columns.flatMap((col) => col.uniqEntityNames))
    if (entityNames.length === 0) return

    interface Row {
        entityName: EntityName
        time: Time
        cells: string[]
    }
    const rows: Row[] = []
    for (const entityName of entityNames) {
        const cells: string[] = []
        let latestTime: Time | undefined
        for (const column of columns) {
            const entityRows = column.owidRowsByEntityName.get(entityName) ?? []
            const eligible =
                endTime === undefined
                    ? entityRows
                    : entityRows.filter((row) => row.time <= endTime)
            // owidRows is time-sorted, so the last eligible row is the latest.
            const row = eligible.at(-1)
            cells.push(
                row?.value === undefined
                    ? ""
                    : column.formatValueShort(row.value)
            )
            if (row && (latestTime === undefined || row.time > latestTime))
                latestTime = row.time
        }
        if (cells.every((cell) => cell === "")) continue
        rows.push({ entityName, time: latestTime ?? 0, cells })
    }
    if (rows.length === 0) return

    const times = _.uniq(rows.map((row) => row.time))
    const showTimeColumn = times.length > 1
    const sharedTime = times[0]

    yield ""
    yield "## Latest value for every entity"
    yield ""
    yield showTimeColumn
        ? "Each entity at its own latest year, at or before the year the chart ends on."
        : `All entities in ${sharedTime}.`

    const valueHeadings = columns.map((column) => column.displayName)
    const headings = showTimeColumn
        ? ["Entity", ...valueHeadings, "Year"]
        : ["Entity", ...valueHeadings]

    yield ""
    yield `| ${headings.join(" | ")} |`
    yield `| --- | ${headings
        .slice(1)
        .map(() => "---:")
        .join(" | ")} |`

    for (const row of _.sortBy(rows, (row) => row.entityName)) {
        const cells = showTimeColumn
            ? [...row.cells, String(row.time)]
            : row.cells
        yield `| ${row.entityName} | ${cells.join(" | ")} |`
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
        yield `### ${getTitle(column)}`
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
    lines.push(...getAllEntityValuesSection(grapherState))
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
