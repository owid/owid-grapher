import * as _ from "lodash-es"
import { OwidColumnDef, stripDetailOnDemandLinks } from "@ourworldindata/utils"
import type { CoreColumn } from "@ourworldindata/core-table"
import type {
    GrapherValuesJson,
    GrapherValuesJsonDataPoint,
    GrapherValuesJsonDataPoints,
    Time,
} from "@ourworldindata/types"
import { GrapherState } from "@ourworldindata/grapher"
import {
    getCitationLines,
    getDescriptionLines,
    getSourcesSection,
    getTitle,
} from "./readmeTools.js"

/**
 * A scatter plot's x indicator is reported in `points.x`, not among `points.y`, so
 * looking only at the y series renders half of every plotted coordinate blank.
 */
function findPoint(
    points: GrapherValuesJsonDataPoints | undefined,
    columnSlug: string
): GrapherValuesJsonDataPoint | undefined {
    if (!points) return undefined
    const yPoint = points.y.find((point) => point.columnSlug === columnSlug)
    if (yPoint) return yPoint
    return points.x?.columnSlug === columnSlug ? points.x : undefined
}

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
    yield ""
    yield "Values at the years the chart starts and ends on. A year in brackets means that entity's data begins or ends there instead, and the value is from that year."

    for (const slug of columnSlugs) {
        const column = columns[slug]
        const unit = column.unit ? `, in ${column.unit}` : ""
        yield ""
        yield `**${column.name}**${unit}.`

        // Times are formatted by the point that carries them: on a daily or
        // quarterly chart the raw Time is a day offset from the epoch, which would
        // print as "18262" rather than a date.
        const bounds = (
            [
                ["start", first.startTime, first.startValues],
                ["end", first.endTime, first.endValues],
            ] as const
        )
            .filter(([, time, points]) => time !== undefined && points)
            .map(([bound, time, points]) => ({
                bound,
                time: time as Time,
                heading: findPoint(points, slug)?.formattedTime ?? String(time),
            }))
        // A chart whose start and end resolve to the same time would otherwise
        // print the same column twice under two identical headings.
        const headings = _.uniqBy(bounds, (bound) => bound.time)
        if (headings.length === 0) continue

        yield ""
        yield `| Entity | ${headings.map((h) => h.heading).join(" | ")} |`
        yield `| --- | ${headings.map(() => "---:").join(" | ")} |`

        for (const values of withData) {
            const cells = headings.map(({ bound, time }) => {
                const points =
                    bound === "start" ? values.startValues : values.endValues
                const point = findPoint(points, slug)
                if (!point) return ""
                // An entity whose series starts later or ends earlier than the
                // chart reports its own first or last value. Without the year it
                // came from, the heading's year gets attributed to it (Oceania's
                // 1870 value under "1770").
                const ownTime =
                    bound === "start" ? values.startTime : values.endTime
                return ownTime !== undefined && ownTime !== time
                    ? `${point.formattedValue} (${point.formattedTime ?? ownTime})`
                    : point.formattedValue
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
 * Only the chart's first indicator is tabulated. Both questions this section exists to
 * answer presuppose a single quantity, and reporting several indicators per row means
 * either a row that mixes times under one time cell or a time cell per value; naming
 * one indicator and pointing at the CSV for the rest is the honest version.
 */
function* getAllEntityValuesSection(
    grapherState: GrapherState
): Generator<string, void, undefined> {
    const table = grapherState.tableForDownload
    const slugs = grapherState.yColumnSlugs.filter((slug) => table.has(slug))
    if (slugs.length === 0) return
    const column = table.get(slugs[0])

    const endTime = grapherState.endTime
    const rows = column.uniqEntityNames.flatMap((entityName) => {
        const entityRows = column.owidRowsByEntityName.get(entityName) ?? []
        const eligible =
            endTime === undefined
                ? entityRows
                : entityRows.filter((row) => row.time <= endTime)
        // owidRows is time-sorted, so the last eligible row is the latest.
        const row = eligible.at(-1)
        if (!row || row.value === undefined) return []
        return [
            {
                entityName,
                time: row.time,
                value: column.formatValueShort(row.value),
            },
        ]
    })
    if (rows.length === 0) return

    const times = _.uniq(rows.map((row) => row.time))
    const showTimeColumn = times.length > 1

    yield ""
    yield "## Latest value for every entity"
    yield ""
    yield showTimeColumn
        ? "Each entity at its own latest time, at or before the time the chart ends on."
        : `All entities in ${column.formatTime(times[0])}.`
    if (slugs.length > 1) {
        yield ""
        yield `This chart plots ${slugs.length} indicators; only **${column.displayName}** is tabulated here. The others are in the CSV linked below.`
    }

    const headings = showTimeColumn
        ? ["Entity", column.displayName, "Time"]
        : ["Entity", column.displayName]

    yield ""
    yield `| ${headings.join(" | ")} |`
    yield `| --- | ${headings
        .slice(1)
        .map(() => "---:")
        .join(" | ")} |`

    for (const row of _.sortBy(rows, (row) => row.entityName)) {
        const cells = showTimeColumn
            ? [row.value, column.formatTime(row.time)]
            : [row.value]
        yield `| ${row.entityName} | ${cells.join(" | ")} |`
    }
}

function* getDataAccessSection(
    baseUrl: string,
    search: string
): Generator<string, void, undefined> {
    yield ""
    yield "## Get this data"
    yield ""
    yield `- Data as CSV: ${baseUrl}.csv${search}`
    yield `- Metadata as JSON: ${baseUrl}.metadata.json${search}`
    yield `- Chart image: ${baseUrl}.png${search}`
    yield `- Interactive chart: ${baseUrl}${search}`
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
    // `canonicalUrl` is `baseUrl + queryStr`, so building extensions from it yields
    // `/slug?country=~USA.csv?country=~USA` — a URL that resolves to the HTML page
    // with a mangled country value. The extension belongs on the query-free base.
    const baseUrl = grapherState.baseUrl ?? ""
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
    lines.push(...getDataAccessSection(baseUrl, search))

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

interface MediaRange {
    type: string
    q: number
    index: number
}

/**
 * Whether a request would rather have markdown than HTML for a page URL, so
 * `/grapher/<slug>` can serve the same document as `/grapher/<slug>.md` to
 * clients that ask for it. Browsers send `text/html` first and never mention
 * markdown; Claude Code's fetcher sends `text/markdown, text/html, *&#47;*`.
 * Markdown wins when it is present with a q-value at least as high as HTML's,
 * with list order breaking ties.
 */
export function prefersMarkdown(accept: string | null | undefined): boolean {
    if (!accept) return false
    const ranges: MediaRange[] = accept.split(",").map((part, index) => {
        const [type, ...params] = part.trim().split(";")
        const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="))
        return {
            type: type.trim().toLowerCase(),
            q: q ? Number(q.slice(2)) : 1,
            index,
        }
    })
    const markdown = ranges.find((r) => r.type === "text/markdown")
    if (!markdown || !(markdown.q > 0)) return false
    const html = ranges.find((r) => r.type === "text/html")
    if (!html || !(html.q > 0)) return true
    return (
        markdown.q > html.q ||
        (markdown.q === html.q && markdown.index < html.index)
    )
}
