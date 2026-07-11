import type {
    CardRow,
    CuratedMetric,
    MetricSeries,
    SeriesPoint,
} from "../types.js"
import {
    HIGHLIGHTS_LABEL,
    HIGHLIGHTS_TARGET,
    TOPIC_TARGET,
    metricPoolFor,
} from "./catalog.js"
import { changePhrase } from "./format.js"

// time=earliest..latest is essential: without it, filtered CSV returns only the chart's default
// (usually a single latest year), so a metric arrives with one point and gets dropped. The range
// returns the full series the chart exposes (≥2 points where any history exists). tab=line is
// equally essential for charts that default to the map tab (e.g. the democracy indices): their
// filtered CSV otherwise ignores the country filter and returns only endpoint years.
const csvUrl = (slug: string, code: string, compCode: string): string =>
    `https://ourworldindata.org/grapher/${slug}.csv?csvType=filtered&useColumnShortNames=true&tab=line&time=earliest..latest&country=~${code}~${compCode}`

/** Fetch a URL's text, cached in sessionStorage for the visit */
async function fetchText(url: string): Promise<string> {
    const key = "ylid:" + url
    let txt: string | null = null
    try {
        txt = sessionStorage.getItem(key)
    } catch {
        // sessionStorage unavailable (e.g. blocked); fall through to fetch
    }
    if (txt === null) {
        try {
            const r = await fetch(url)
            txt = r.ok ? await r.text() : ""
        } catch {
            txt = ""
        }
        try {
            sessionStorage.setItem(key, txt)
        } catch {
            // quota exceeded — fine, just uncached
        }
    }
    return txt
}

/** Split one CSV line, respecting double-quoted fields (entity names can contain commas) */
function splitCsvLine(line: string): string[] {
    if (!line.includes('"')) return line.split(",")
    const fields: string[] = []
    let field = ""
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') {
                field += '"'
                i++
            } else if (ch === '"') inQuotes = false
            else field += ch
        } else if (ch === '"') inQuotes = true
        else if (ch === ",") {
            fields.push(field)
            field = ""
        } else field += ch
    }
    fields.push(field)
    return fields
}

/** Extract the series for `code` and `compCode` from a filtered grapher CSV */
function parseCsv(
    txt: string,
    valueColumn: string | undefined,
    code: string,
    compCode: string
): MetricSeries {
    const out: MetricSeries = { country: [], comp: [] }
    if (!txt) return out
    const lines = txt.trim().split("\n")
    const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
    const codeIdx = header.indexOf("code")
    const yearIdx = header.indexOf("year")
    let valueIdx = header.indexOf((valueColumn ?? "").toLowerCase())
    if (valueIdx < 0)
        valueIdx = header.findIndex(
            (h) => !["entity", "code", "year"].includes(h)
        )
    if (codeIdx < 0 || yearIdx < 0 || valueIdx < 0) return out
    for (let i = 1; i < lines.length; i++) {
        const row = splitCsvLine(lines[i])
        const v = parseFloat(row[valueIdx])
        const y = parseInt(row[yearIdx], 10)
        if (!Number.isFinite(v) || !Number.isFinite(y)) continue
        if (row[codeIdx] === code) out.country.push([y, v])
        else if (row[codeIdx] === compCode) out.comp.push([y, v])
    }
    out.country.sort((a, b) => a[0] - b[0])
    out.comp.sort((a, b) => a[0] - b[0])
    return out
}

async function fetchSeries(
    metric: CuratedMetric,
    code: string,
    compCode: string
): Promise<MetricSeries> {
    const txt = await fetchText(csvUrl(metric.slug, code, compCode))
    return parseCsv(txt, metric.valueColumn, code, compCode)
}

/** The series value nearest to a year */
function nearest(series: SeriesPoint[], year: number): number {
    let best = series[0]
    for (const p of series)
        if (Math.abs(p[0] - year) < Math.abs(best[0] - year)) best = p
    return best[1]
}

/** Compute one card row from a metric's series, or null if there's nothing to show */
function computeRow(
    meta: CuratedMetric,
    series: MetricSeries,
    birthYear: number
): CardRow | null {
    const pts = series.country
    if (!pts || pts.length < 2) return null
    const thenPt = pts.find((p) => p[0] >= birthYear) ?? pts[0]
    const nowPt = pts[pts.length - 1]
    if (thenPt[0] === nowPt[0]) return null
    const then = thenPt[1]
    const now = nowPt[1]
    // tone: green = changed the good way, orange = the bad way, neutral = no value
    // judgment. The good/bad direction call is made by the AI curator, offline.
    let tone: CardRow["tone"] = "neutral"
    if (meta.goodDirection === "up") tone = now < then ? "warn" : "good"
    else if (meta.goodDirection === "down") tone = now > then ? "warn" : "good"
    // show the comparison overlay only for comparable metrics — absolute totals /
    // global-only series can still be shown, just not vs another entity
    const comp = meta.comparable === false ? [] : series.comp
    const fromYear = thenPt[0]
    return {
        meta,
        tone,
        thenYear: thenPt[0],
        nowYear: nowPt[0],
        then,
        now,
        compThen: comp.length ? nearest(comp, thenPt[0]) : null,
        compNow: comp.length ? nearest(comp, nowPt[0]) : null,
        country: pts.filter((p) => p[0] >= fromYear),
        comp: comp.filter((p) => p[0] >= fromYear),
        phrase: changePhrase(
            meta.framing ?? "relative",
            meta.format,
            then,
            now
        ),
    }
}

/**
 * Build the card rows for a country + birth year + topic: assemble the refined
 * metric pool, fetch each metric's series (country + comparison entity), compute
 * the then→now deltas, and keep the curated order.
 */
export async function buildCardRows(
    code: string,
    birthYear: number,
    topic: string,
    compCode: string
): Promise<CardRow[]> {
    const pool = metricPoolFor(code, topic)
    const computed = await Promise.all(
        pool.map(async (m) =>
            computeRow(m, await fetchSeries(m, code, compCode), birthYear)
        )
    )
    // Keep the curated ordering (best-first, diversity-aware). We deliberately do
    // NOT re-sort by magnitude of change — that always crowned internet (~0.5%→90%
    // ≈ ×150) first in every view.
    let rows = computed.filter((r) => r !== null)
    // semantic de-duplication is the curator's job; here we only guard the
    // zero-risk case of two slugs with an *identical* series — keep the top one
    const seen = new Set<string>()
    rows = rows.filter((r) => {
        const sig = `${r.thenYear}|${Math.round(r.then * 1e3)}|${Math.round(r.now * 1e3)}`
        if (seen.has(sig)) return false
        seen.add(sig)
        return true
    })
    // the one hard mechanical constraint: the metric's data must actually reach
    // into this person's lifetime — otherwise there's no "since you were born"
    // change to show. Relevance/informativeness is the curator's editorial call.
    rows = rows.filter((r) => r.nowYear >= birthYear)
    const limit = topic === HIGHLIGHTS_LABEL ? HIGHLIGHTS_TARGET : TOPIC_TARGET
    return rows.slice(0, limit)
}
