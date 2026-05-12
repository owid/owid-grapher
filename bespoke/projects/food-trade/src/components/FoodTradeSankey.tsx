import { useMemo } from "react"
import { useParentSize } from "@visx/responsive"

import { formatValue } from "@ourworldindata/utils"
import { OwidVariableRoundingMode } from "@ourworldindata/types"
import { OwidDistinctColors } from "@ourworldindata/grapher/src/color/CustomSchemes.js"

import {
    Sankey,
    SankeyLink,
    SankeyNode,
} from "../../../../components/Sankey/Sankey.js"

import { TradeRow } from "../data.js"

export const TOP_N = 10
// "All" modes (aggregated across products) yield flatter distributions where
// the long tail is more informative, so we allow a few more flows.
export const TOP_N_FOR_ALL = 15
// Importers below this share of the total are bucketed into "Other" instead of
// being shown individually, even if they fall within the top N.
const SHARE_FLOOR = 0.01
const SOURCE_COLOR = OwidDistinctColors.Denim
// Long product or country names are truncated in node labels so they don't
// blow up the auto-computed left/right margins. The full name is still
// available via the link's hover tooltip.
const MAX_LABEL_LENGTH = 30
const truncateLabel = (s: string): string =>
    s.length > MAX_LABEL_LENGTH ? s.slice(0, MAX_LABEL_LENGTH - 1) + "…" : s

export const formatTrade = (v: number) =>
    formatValue(v, {
        unit: "tonnes",
        numberAbbreviation: "long",
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures: 2,
    })

const formatPct = (v: number) =>
    formatValue(v, {
        unit: "%",
        numDecimalPlaces: 0,
        numberAbbreviation: false,
    })

type SankeyBuild = {
    nodes: SankeyNode[]
    links: SankeyLink[]
    columnLabels: (string | undefined)[]
}

export function FoodTradeSankey({
    incoming,
    outgoing,
    country,
    groupBy = "country",
    topN = TOP_N,
}: {
    incoming: TradeRow[]
    outgoing: TradeRow[]
    country: string
    /** Whether the side flows are aggregated by trading partner (country) or
     * by item (product). */
    groupBy?: "country" | "product"
    /** Max nodes per side before bucketing into "Other". */
    topN?: number
}) {
    const incomingKey = groupBy === "product" ? "item" : "exporter"
    const outgoingKey = groupBy === "product" ? "item" : "importer"
    const importsHeader =
        groupBy === "product" ? "Imports →" : "Imports from →"
    const exportsHeader = groupBy === "product" ? "Exports →" : "Exports to →"

    const incomingBuild = useMemo(
        () =>
            buildIncoming(incoming, country, incomingKey, topN, importsHeader),
        [incoming, country, incomingKey, topN, importsHeader]
    )
    const outgoingBuild = useMemo(
        () =>
            buildOutgoing(outgoing, country, outgoingKey, topN, exportsHeader),
        [outgoing, country, outgoingKey, topN, exportsHeader]
    )

    return (
        <div className="food-trade-sankey food-trade-sankey--split">
            <HalfSankey
                build={incomingBuild}
                emptyHeader="No imports"
                emptySubtext="No imports recorded."
                pinNodeIdToTop={country}
            />
            <HalfSankey
                build={outgoingBuild}
                emptyHeader="No exports"
                emptySubtext="No exports recorded."
                pinNodeIdToTop={country}
            />
        </div>
    )
}

function HalfSankey({
    build,
    emptyHeader,
    emptySubtext,
    pinNodeIdToTop,
}: {
    build: SankeyBuild | null
    emptyHeader: string
    emptySubtext: string
    pinNodeIdToTop?: string
}) {
    const { parentRef, width, height } = useParentSize()
    return (
        <div ref={parentRef} className="food-trade-sankey__half">
            {build ? (
                width > 0 &&
                height > 0 && (
                    <Sankey
                        nodes={build.nodes}
                        links={build.links}
                        width={width}
                        height={height}
                        margin={{ top: 8, right: 0, bottom: 8, left: 0 }}
                        nodePadding={12}
                        nodeColor={() => SOURCE_COLOR}
                        linkColor={() => SOURCE_COLOR}
                        formatValue={formatTrade}
                        columnLabels={build.columnLabels}
                        // Skip d3-sankey relaxation so positions stay
                        // predictable (input order with proportional heights).
                        iterations={0}
                        // Force the country column's single rect to the top
                        // so it aligns across the two halves regardless of
                        // import / export volume.
                        pinNodeIdToTop={pinNodeIdToTop}
                    />
                )
            ) : (
                <div className="food-trade-sankey__empty">
                    <div className="food-trade-sankey__empty-header">
                        {emptyHeader}
                    </div>
                    <div className="food-trade-sankey__empty-subtext">
                        {emptySubtext}
                    </div>
                </div>
            )}
        </div>
    )
}

type PartnerRow = { partner: string; value: number }

// Aggregate trade rows by partner (collapsing multiple items into one
// per-partner total), then pick the top N partners. Drop those below
// SHARE_FLOOR. Always keep at least the top 1 for pathologically flat
// distributions so we never show nothing.
function selectTopWithFloor(
    rows: TradeRow[],
    partnerKey: "exporter" | "importer" | "item",
    n: number
): { top: PartnerRow[]; otherTotal: number; total: number } {
    const totals = new Map<string, number>()
    for (const r of rows) {
        if (!Number.isFinite(r.value) || r.value <= 0) continue
        totals.set(r[partnerKey], (totals.get(r[partnerKey]) ?? 0) + r.value)
    }
    const sorted = Array.from(totals, ([partner, value]) => ({
        partner,
        value,
    })).sort((a, b) => b.value - a.value)
    const total = sorted.reduce((sum, d) => sum + d.value, 0)

    const topCandidates = sorted.slice(0, n)
    const aboveFloor = topCandidates.filter(
        (d) => total > 0 && d.value / total >= SHARE_FLOOR
    )
    const top = aboveFloor.length > 0 ? aboveFloor : topCandidates.slice(0, 1)
    const rest = sorted.slice(top.length)
    const otherTotal = rest.reduce((sum, d) => sum + d.value, 0)

    return { top, otherTotal, total }
}

function makeValueLabel(value: number, sideTotal: number): string {
    return sideTotal > 0
        ? `${formatTrade(value)} (${formatPct((value / sideTotal) * 100)})`
        : formatTrade(value)
}

// Build a 2-column Sankey for the imports side: senders → country. Returns
// null when there's no incoming flow (caller renders an empty placeholder).
function buildIncoming(
    rows: TradeRow[],
    country: string,
    key: "exporter" | "item",
    n: number,
    header: string
): SankeyBuild | null {
    const sel = selectTopWithFloor(rows, key, n)
    if (sel.top.length === 0) return null

    const nodes: SankeyNode[] = []
    const links: SankeyLink[] = []

    // IDs prefixed so a partner appearing on both sides ends up as two
    // distinct nodes (across the two Sankeys).
    for (const d of sel.top) {
        const id = `incoming:${d.partner}`
        nodes.push({
            id,
            label: [
                truncateLabel(d.partner),
                makeValueLabel(d.value, sel.total),
            ],
        })
        links.push({ source: id, target: country, value: d.value })
    }
    if (sel.otherTotal > 0) {
        const id = "__incoming-other__"
        nodes.push({ id, label: "Other" })
        links.push({ source: id, target: country, value: sel.otherTotal })
    }
    // Country sits on the right as the sink. Empty label — the chart title
    // names it, and the right edge meets the export half's country rect.
    nodes.push({ id: country, label: "" })

    return {
        nodes,
        links,
        columnLabels: [header, undefined],
    }
}

// Build a 2-column Sankey for the exports side: country → receivers.
function buildOutgoing(
    rows: TradeRow[],
    country: string,
    key: "importer" | "item",
    n: number,
    header: string
): SankeyBuild | null {
    const sel = selectTopWithFloor(rows, key, n)
    if (sel.top.length === 0) return null

    const nodes: SankeyNode[] = []
    const links: SankeyLink[] = []

    // Country sits on the left as the source.
    nodes.push({ id: country, label: "" })
    for (const d of sel.top) {
        const id = `outgoing:${d.partner}`
        nodes.push({
            id,
            label: [
                truncateLabel(d.partner),
                makeValueLabel(d.value, sel.total),
            ],
        })
        links.push({ source: country, target: id, value: d.value })
    }
    if (sel.otherTotal > 0) {
        const id = "__outgoing-other__"
        nodes.push({ id, label: "Other" })
        links.push({ source: country, target: id, value: sel.otherTotal })
    }

    return {
        nodes,
        links,
        columnLabels: [undefined, header],
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bilateral Sankey: shown when Country = "All countries" + a specific product.
// Top exporters on the left, top importers on the right, with bilateral
// pair-flow links between them. No central country.
// ─────────────────────────────────────────────────────────────────────────────

const OTHER_EXPORTERS_ID = "exporter:__other__"
const OTHER_IMPORTERS_ID = "importer:__other__"

export function FoodTradeBilateralSankey({ rows }: { rows: TradeRow[] }) {
    const { parentRef, width, height } = useParentSize()

    const { nodes, links, columnLabels } = useMemo(
        () => buildBilateral(rows, TOP_N),
        [rows]
    )

    return (
        <div ref={parentRef} className="food-trade-sankey">
            {width > 0 && height > 0 && (
                <Sankey
                    nodes={nodes}
                    links={links}
                    width={width}
                    height={height}
                    margin={{ top: 8, right: 0, bottom: 8, left: 0 }}
                    nodePadding={12}
                    nodeColor={() => SOURCE_COLOR}
                    linkColor={() => SOURCE_COLOR}
                    formatValue={formatTrade}
                    columnLabels={columnLabels}
                />
            )}
        </div>
    )
}

function buildBilateral(
    rows: TradeRow[],
    n: number
): {
    nodes: SankeyNode[]
    links: SankeyLink[]
    columnLabels: (string | undefined)[]
} {
    const exporterSel = selectTopWithFloor(rows, "exporter", n)
    const importerSel = selectTopWithFloor(rows, "importer", n)
    // Exporter and importer totals are equal in theory (same trade flow seen
    // from both sides). In practice tiny floating-point diffs are possible.
    const total = Math.max(exporterSel.total, importerSel.total)

    if (total === 0) {
        return { nodes: [], links: [], columnLabels: [] }
    }

    const topExporters = new Set(exporterSel.top.map((d) => d.partner))
    const topImporters = new Set(importerSel.top.map((d) => d.partner))

    // Aggregate row values into (categorized exporter, categorized importer)
    // pairs. Non-top countries collapse into the Other buckets per side.
    type Pair = { exp: string; imp: string; value: number }
    const pairs = new Map<string, Pair>()
    for (const r of rows) {
        if (!Number.isFinite(r.value) || r.value <= 0) continue
        const exp = topExporters.has(r.exporter) ? r.exporter : "__other__"
        const imp = topImporters.has(r.importer) ? r.importer : "__other__"
        const key = `${exp}\x00${imp}`
        const existing = pairs.get(key)
        if (existing) existing.value += r.value
        else pairs.set(key, { exp, imp, value: r.value })
    }

    // Apply 1% floor on top-to-top links only. Other-bucket links always
    // render when non-zero so the aggregate isn't lost. If the floor filters
    // out every pair (pathological case: all top countries trade with each
    // other in tiny amounts and no Other buckets exist), fall back to
    // showing all positive pairs — better than rendering nothing.
    const allPositive = Array.from(pairs.values()).filter((p) => p.value > 0)
    const filtered = allPositive.filter((p) => {
        const involvesOther = p.exp === "__other__" || p.imp === "__other__"
        if (involvesOther) return true
        return p.value / total >= SHARE_FLOOR
    })
    const visiblePairs = filtered.length > 0 ? filtered : allPositive

    // Determine which side nodes are actually used (referenced by visible
    // links) so we don't render a top-N node that has no flow above the floor.
    const usedExporters = new Set(visiblePairs.map((p) => p.exp))
    const usedImporters = new Set(visiblePairs.map((p) => p.imp))

    const nodes: SankeyNode[] = []
    const links: SankeyLink[] = []

    const valueLabel = (value: number, sideTotal: number) =>
        sideTotal > 0
            ? `${formatTrade(value)} (${formatPct((value / sideTotal) * 100)})`
            : formatTrade(value)

    // Left column: top exporters in order of total (largest first), then Other.
    for (const d of exporterSel.top) {
        if (!usedExporters.has(d.partner)) continue
        nodes.push({
            id: `exporter:${d.partner}`,
            label: [
                truncateLabel(d.partner),
                valueLabel(d.value, exporterSel.total),
            ],
        })
    }
    if (usedExporters.has("__other__")) {
        nodes.push({ id: OTHER_EXPORTERS_ID, label: "Other" })
    }

    // Right column: top importers, then Other.
    for (const d of importerSel.top) {
        if (!usedImporters.has(d.partner)) continue
        nodes.push({
            id: `importer:${d.partner}`,
            label: [
                truncateLabel(d.partner),
                valueLabel(d.value, importerSel.total),
            ],
        })
    }
    if (usedImporters.has("__other__")) {
        nodes.push({ id: OTHER_IMPORTERS_ID, label: "Other" })
    }

    // Build links from visible pairs.
    for (const p of visiblePairs) {
        const sourceId =
            p.exp === "__other__" ? OTHER_EXPORTERS_ID : `exporter:${p.exp}`
        const targetId =
            p.imp === "__other__" ? OTHER_IMPORTERS_ID : `importer:${p.imp}`
        links.push({ source: sourceId, target: targetId, value: p.value })
    }

    return {
        nodes,
        links,
        columnLabels: ["Exporters →", "Importers"],
    }
}
