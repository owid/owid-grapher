import path from "path"
import { Dataset, parseDataset } from "./csv.js"
import { fetchTextCached } from "./http.js"
import {
    ChartSpec,
    RESULTS_DIR,
    grapherUrl,
    splitPath,
    stagingOrigin,
} from "./charts.js"

export interface ColumnMeta {
    titleShort: string
    titleLong: string
    unit: string
    shortUnit: string
    citationShort: string
    type: string
}

export interface ChartMetadata {
    chart: { title: string; selection: string[]; citation: string }
    columns: Record<string, ColumnMeta>
}

/**
 * Everything the case builder and the value checker know about one chart view,
 * read from the pre-existing data endpoints (not from the markdown under test):
 * the full CSV (every entity), the filtered CSV (the view's selection and time
 * range) and the metadata JSON.
 */
export interface ChartView {
    spec: ChartSpec
    slug: string
    params: URLSearchParams
    origin: string
    full: Dataset
    filtered: Dataset
    meta: ChartMetadata
    /** Numeric columns present in both the CSV and the metadata. */
    columns: string[]
    selection: string[]
    viewStart: number | undefined
    viewEnd: number | undefined
}

export async function loadView(
    spec: ChartSpec,
    branch: string
): Promise<ChartView> {
    const origin = stagingOrigin(branch)
    const { slug, params } = splitPath(spec.path)
    const dir = path.join(RESULTS_DIR, "inputs", spec.key)
    const shortNames = { useColumnShortNames: "true" }

    const [fullCsv, filteredCsv, metaJson] = await Promise.all([
        fetchTextCached(
            grapherUrl(origin, slug, ".csv", params, {
                ...shortNames,
                csvType: "full",
            }),
            path.join(dir, "full.csv")
        ),
        fetchTextCached(
            grapherUrl(origin, slug, ".csv", params, {
                ...shortNames,
                csvType: "filtered",
            }),
            path.join(dir, "filtered.csv")
        ),
        fetchTextCached(
            grapherUrl(origin, slug, ".metadata.json", params, shortNames),
            path.join(dir, "metadata.json")
        ),
    ])

    const full = parseDataset(fullCsv)
    const filtered = parseDataset(filteredCsv)
    const meta = JSON.parse(metaJson) as ChartMetadata
    let columns = full
        .numericColumns()
        .filter((c) => meta.columns[c] && meta.columns[c].type !== "String")
    // On charts about something else, the population column is only there to
    // size scatter points or annotate tooltips; nobody asks the chart for it.
    if (columns.length > 1)
        columns = columns.filter((c) => c !== "population_historical")
    if (spec.columns) columns = columns.filter((c) => spec.columns!.includes(c))
    // A country= param replaces the chart's default selection; the filtered CSV
    // is exactly that selection.
    const selection = (
        params.has("country")
            ? filtered.entities()
            : (meta.chart.selection ?? [])
    ).filter((e) => full.byEntity.has(e))

    // The years the chart displays for its selection. Grapher decides these
    // (config min/max time, the first selected entity's data range), so read
    // them back from the pre-existing values.json endpoint rather than guessing
    // from the CSV; an explicit time= param wins.
    let viewStart = filtered.minYear() ?? full.minYear()
    let viewEnd = filtered.maxYear() ?? full.maxYear()
    const timeParam = params.get("time")?.match(/^(-?\d+)\.\.(-?\d+)$/)
    if (timeParam) {
        viewStart = Number(timeParam[1])
        viewEnd = Number(timeParam[2])
    } else {
        const valuesJson = await fetchTextCached(
            grapherUrl(origin, slug, ".values.json", params),
            path.join(dir, "values.json")
        )
        const values = JSON.parse(valuesJson) as {
            startTime?: number
            endTime?: number
        }
        if (typeof values.startTime === "number") viewStart = values.startTime
        if (typeof values.endTime === "number") viewEnd = values.endTime
    }

    return {
        spec,
        slug,
        params,
        origin,
        full,
        filtered,
        meta,
        columns,
        selection,
        viewStart,
        viewEnd,
    }
}

/**
 * Producer names from a citationShort like
 * "Riley (2005); Zijdeman et al. (2015); HMD (2025) – with major processing by Our World in Data".
 */
export function producersFromCitation(citation: string): string[] {
    const withoutProcessing = citation.split(/\s[–-]\s(?:with|processed)/i)[0]
    const noise = /^(and )?(other|various) sources$|^population based on/i
    return withoutProcessing
        .split(/;|,|\/|\band\b/)
        .map((part) =>
            part
                .replace(/\([^)]*\)/g, "")
                .replace(/\s+/g, " ")
                .trim()
        )
        .filter((name) => name.length > 1 && !noise.test(name))
}

export function sourceNames(view: ChartView): string[] {
    const names = new Set<string>()
    for (const column of view.columns) {
        for (const name of producersFromCitation(
            view.meta.columns[column]?.citationShort ?? ""
        ))
            names.add(name)
    }
    return [...names]
}
