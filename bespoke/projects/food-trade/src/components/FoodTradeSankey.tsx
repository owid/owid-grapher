import { useMemo } from "react"
import { useParentSize } from "@visx/responsive"

import { formatValue } from "@ourworldindata/utils"
import {
    ColorSchemeName,
    OwidVariableRoundingMode,
} from "@ourworldindata/types"
import { ColorSchemes } from "@ourworldindata/grapher/src/color/ColorSchemes.js"

import {
    LABEL_OFFSET,
    measureMaxLabelWidth,
    Sankey,
    SankeyLink,
    SankeyNode,
} from "../../../../components/Sankey/Sankey.js"

import { TradeRow } from "../data.js"

export const TOP_N = 10
// Importers below this share of the total are bucketed into "Other" instead of
// being shown individually, even if they fall within the top N.
const SHARE_FLOOR = 0.01
// Used for the central country only; the "Other" bucket gets a regular
// palette slot like any other partner.
const NEUTRAL_COLOR = "#767676"
// Sentinel key in the color map so the "Other" bucket gets a stable palette
// color, shared across the imports / exports halves and the bilateral view.
const OTHER_KEY = "__other__"

// Owid-distinct uses a 12-color permutation for ≤12 entities and a 24-color
// one for >12, so picking the scheme's colors via getColors() gives us
// whichever set fits our partner count without manual switching.
const OWID_DISTINCT = ColorSchemes.get(ColorSchemeName["owid-distinct"])

// Build a country → color map from the owid-distinct palette, assigned in
// descending order of value (top-1 partner gets the first color, etc.).
function buildCountryColorMap(
    valueByCountry: Map<string, number>
): Map<string, string> {
    const sorted = Array.from(valueByCountry.entries()).sort(
        (a, b) => b[1] - a[1]
    )
    const colors = OWID_DISTINCT.getColors(sorted.length)
    const map = new Map<string, string>()
    sorted.forEach(([countryName], i) => {
        map.set(countryName, colors[i] ?? NEUTRAL_COLOR)
    })
    return map
}
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
    sourceLabel?: string
    targetLabel?: string
}

export function FoodTradeSankey({
    incoming,
    outgoing,
    country,
    incomingTotal,
    outgoingTotal,
    view = "both",
}: {
    incoming: TradeRow[]
    outgoing: TradeRow[]
    country: string
    /** Pre-computed totals used in the column headers. */
    incomingTotal: number
    outgoingTotal: number
    /** Which halves to show. Single-half views drop their heading and take
     * the full width. */
    view?: "both" | "imports" | "exports"
}) {
    const showImports = view === "both" || view === "imports"
    const showExports = view === "both" || view === "exports"

    // When both halves are visible the two headings read as one sentence:
    // "{country} imports X" + "and exports Y". In single-half views the
    // exports heading is rephrased to stand alone.
    const importsHeader = `${country} imports ${formatTrade(incomingTotal)}`
    const exportsHeader =
        view === "both"
            ? `and exports ${formatTrade(outgoingTotal)}`
            : `${country} exports ${formatTrade(outgoingTotal)}`

    const incomingBuild = useMemo(
        () =>
            showImports
                ? buildIncoming(incoming, country, TOP_N, importsHeader)
                : null,
        [showImports, incoming, country, importsHeader]
    )
    const outgoingBuild = useMemo(
        () =>
            showExports
                ? buildOutgoing(outgoing, country, TOP_N, exportsHeader)
                : null,
        [showExports, outgoing, country, exportsHeader]
    )

    // Color partner countries by their combined visible value across the
    // visible halves, so a country trading on both sides gets the same color
    // in each.
    const colorMap = useMemo(() => {
        const valueByPartner = new Map<string, number>()
        for (const link of incomingBuild?.links ?? []) {
            const partner = partnerFromCenteredId(link.source)
            if (partner !== null) {
                valueByPartner.set(
                    partner,
                    (valueByPartner.get(partner) ?? 0) + link.value
                )
            }
        }
        for (const link of outgoingBuild?.links ?? []) {
            const partner = partnerFromCenteredId(link.target)
            if (partner !== null) {
                valueByPartner.set(
                    partner,
                    (valueByPartner.get(partner) ?? 0) + link.value
                )
            }
        }
        return buildCountryColorMap(valueByPartner)
    }, [incomingBuild, outgoingBuild])

    const nodeColor = (node: SankeyNode): string => {
        if (node.id === country) return NEUTRAL_COLOR
        const partner = partnerFromCenteredId(node.id)
        if (partner === null) return NEUTRAL_COLOR
        return colorMap.get(partner) ?? NEUTRAL_COLOR
    }

    const linkColor = (link: SankeyLink): string => {
        // Imports: partner is the source; exports: partner is the target.
        const partner =
            partnerFromCenteredId(link.source) ??
            partnerFromCenteredId(link.target)
        if (partner === null) return NEUTRAL_COLOR
        return colorMap.get(partner) ?? NEUTRAL_COLOR
    }

    const isSingleHalf = view !== "both"

    // Equalize outer label margins across the two halves so the inner flow
    // regions end up the same width even if importer/receiver label widths
    // differ. Only applies in the both-halves view; single-half views use
    // each Sankey's natural auto-computed margin.
    const sharedOuterMargin = useMemo(() => {
        if (isSingleHalf || !incomingBuild || !outgoingBuild) return undefined
        const max = Math.max(
            maxLabelWidthForBuild(incomingBuild),
            maxLabelWidthForBuild(outgoingBuild)
        )
        return max > 0 ? max + LABEL_OFFSET : undefined
    }, [isSingleHalf, incomingBuild, outgoingBuild])

    return (
        <div
            className={`food-trade-sankey food-trade-sankey--split${
                isSingleHalf ? " food-trade-sankey--single" : ""
            }`}
        >
            {showImports && (
                <HalfSankey
                    build={incomingBuild}
                    heading={importsHeader}
                    emptyHeading="No imports"
                    emptySubtext="No imports recorded."
                    align="right"
                    topAnchored
                    nodeColor={nodeColor}
                    linkColor={linkColor}
                    innerMargin={{ left: sharedOuterMargin }}
                />
            )}
            {showExports && (
                <HalfSankey
                    build={outgoingBuild}
                    heading={exportsHeader}
                    emptyHeading="No exports"
                    emptySubtext="No exports recorded."
                    align="left"
                    topAnchored
                    nodeColor={nodeColor}
                    linkColor={linkColor}
                    innerMargin={{ right: sharedOuterMargin }}
                />
            )}
        </div>
    )
}

// Largest label-pixel-width across all nodes in a half-Sankey build. The
// inner-column country node carries an empty label and contributes 0, so it
// doesn't pollute the max.
function maxLabelWidthForBuild(build: SankeyBuild): number {
    return Math.max(0, ...build.nodes.map((n) => measureMaxLabelWidth(n.label)))
}

// Extract the partner key from a centered-Sankey node ID. Returns OTHER_KEY
// for the two Other buckets so they're ranked alongside real partners.
// Returns null for the central country (handled separately).
function partnerFromCenteredId(id: string): string | null {
    if (id === "__incoming-other__" || id === "__outgoing-other__")
        return OTHER_KEY
    if (id.startsWith("incoming:")) return id.slice("incoming:".length)
    if (id.startsWith("outgoing:")) return id.slice("outgoing:".length)
    return null
}

function HalfSankey({
    build,
    heading,
    emptyHeading,
    emptySubtext,
    align,
    topAnchored = false,
    nodeColor,
    linkColor,
    innerMargin,
}: {
    build: SankeyBuild | null
    heading: string
    emptyHeading: string
    emptySubtext: string
    align: "left" | "right"
    topAnchored?: boolean
    nodeColor: (node: SankeyNode) => string
    linkColor: (link: SankeyLink) => string
    innerMargin?: {
        top?: number
        right?: number
        bottom?: number
        left?: number
    }
}) {
    return (
        <div
            className={`food-trade-sankey__half food-trade-sankey__half--${align}`}
        >
            <div className="food-trade-sankey__heading">
                {build ? heading : emptyHeading}
            </div>
            <div className="food-trade-sankey__chart-area">
                {build ? (
                    <HalfSankeyChart
                        build={build}
                        topAnchored={topAnchored}
                        nodeColor={nodeColor}
                        linkColor={linkColor}
                        innerMargin={innerMargin}
                    />
                ) : (
                    <div className="food-trade-sankey__empty-subtext">
                        {emptySubtext}
                    </div>
                )}
            </div>
        </div>
    )
}

function HalfSankeyChart({
    build,
    topAnchored = false,
    nodeColor,
    linkColor,
    innerMargin,
}: {
    build: SankeyBuild
    topAnchored?: boolean
    nodeColor: (node: SankeyNode) => string
    linkColor: (link: SankeyLink) => string
    innerMargin?: {
        top?: number
        right?: number
        bottom?: number
        left?: number
    }
}) {
    const { parentRef, width, height } = useParentSize()
    return (
        <div ref={parentRef} className="food-trade-sankey__chart">
            {width > 0 && height > 0 && (
                <Sankey
                    nodes={build.nodes}
                    links={build.links}
                    width={width}
                    height={height}
                    nodeColor={nodeColor}
                    linkColor={linkColor}
                    innerMargin={innerMargin}
                    // Match the previous iterations={0} + pin-to-top behavior
                    // used for split-half charts.
                    topAnchored={topAnchored}
                />
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
    partnerKey: "exporter" | "importer",
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
    n: number,
    header: string
): SankeyBuild | null {
    const sel = selectTopWithFloor(rows, "exporter", n)
    if (sel.top.length === 0) return null

    const nodes: SankeyNode[] = []
    const links: SankeyLink[] = []

    // IDs prefixed so a partner appearing on both sides ends up as two
    // distinct nodes (across the two Sankeys).
    for (const d of sel.top) {
        const id = `incoming:${d.partner}`
        nodes.push({
            id,
            label: truncateLabel(d.partner),
            value: makeValueLabel(d.value, sel.total),
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
        sourceLabel: header,
    }
}

// Build a 2-column Sankey for the exports side: country → receivers.
function buildOutgoing(
    rows: TradeRow[],
    country: string,
    n: number,
    header: string
): SankeyBuild | null {
    const sel = selectTopWithFloor(rows, "importer", n)
    if (sel.top.length === 0) return null

    const nodes: SankeyNode[] = []
    const links: SankeyLink[] = []

    // Country sits on the left as the source.
    nodes.push({ id: country, label: "" })
    for (const d of sel.top) {
        const id = `outgoing:${d.partner}`
        nodes.push({
            id,
            label: truncateLabel(d.partner),
            value: makeValueLabel(d.value, sel.total),
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
        targetLabel: header,
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

    const { nodes, links, sourceLabel, targetLabel } = useMemo(
        () => buildBilateral(rows, TOP_N),
        [rows]
    )

    // Only exporters carry color in this view; rank them by total flow out.
    // Link source is always an exporter in the bilateral build.
    const colorMap = useMemo(() => {
        const valueByExporter = new Map<string, number>()
        for (const link of links) {
            const exporter = countryFromBilateralId(link.source)
            if (exporter !== null) {
                valueByExporter.set(
                    exporter,
                    (valueByExporter.get(exporter) ?? 0) + link.value
                )
            }
        }
        return buildCountryColorMap(valueByExporter)
    }, [links])

    const nodeColor = (node: SankeyNode): string => {
        // Importer column (including its Other bucket) is uniformly gray.
        if (node.id.startsWith("importer:")) return NEUTRAL_COLOR
        const c = countryFromBilateralId(node.id)
        return c === null ? NEUTRAL_COLOR : (colorMap.get(c) ?? NEUTRAL_COLOR)
    }

    const linkColor = (link: SankeyLink): string => {
        // Color by source (exporter) — flows inherit the exporter's color.
        const src = countryFromBilateralId(link.source)
        return src === null
            ? NEUTRAL_COLOR
            : (colorMap.get(src) ?? NEUTRAL_COLOR)
    }

    return (
        <div ref={parentRef} className="food-trade-sankey">
            {width > 0 && height > 0 && (
                <Sankey
                    nodes={nodes}
                    links={links}
                    width={width}
                    height={height}
                    nodeColor={nodeColor}
                    linkColor={linkColor}
                    sourceLabel={sourceLabel}
                    targetLabel={targetLabel}
                />
            )}
        </div>
    )
}

// Extract the country key from a bilateral-Sankey node ID. Returns OTHER_KEY
// for either Other bucket so they share one color across both sides.
function countryFromBilateralId(id: string): string | null {
    if (id === OTHER_EXPORTERS_ID || id === OTHER_IMPORTERS_ID) return OTHER_KEY
    if (id.startsWith("exporter:")) return id.slice("exporter:".length)
    if (id.startsWith("importer:")) return id.slice("importer:".length)
    return null
}

function buildBilateral(rows: TradeRow[], n: number): SankeyBuild {
    const exporterSel = selectTopWithFloor(rows, "exporter", n)
    const importerSel = selectTopWithFloor(rows, "importer", n)
    // Exporter and importer totals are equal in theory (same trade flow seen
    // from both sides). In practice tiny floating-point diffs are possible.
    const total = Math.max(exporterSel.total, importerSel.total)

    if (total === 0) {
        return { nodes: [], links: [] }
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
            label: truncateLabel(d.partner),
            value: valueLabel(d.value, exporterSel.total),
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
            label: truncateLabel(d.partner),
            value: valueLabel(d.value, importerSel.total),
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

    return { nodes, links }
}
