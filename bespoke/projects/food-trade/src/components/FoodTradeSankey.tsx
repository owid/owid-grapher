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

const TOP_N = 10
// Importers below this share of the total are bucketed into "Other" instead of
// being shown individually, even if they fall within the top N.
const SHARE_FLOOR = 0.01
const SOURCE_COLOR = OwidDistinctColors.Denim

// When trade only flows in one direction, a phantom node + link is added on
// the empty side so d3-sankey lays out a 3-column structure. This keeps the
// country at the visual midpoint and lets both column headers render. The
// phantom is rendered transparent and sized as a tiny fraction of the real
// flow so it never dominates the layout — even when actual values are small.
const PHANTOM_INCOMING_ID = "__phantom-incoming__"
const PHANTOM_OUTGOING_ID = "__phantom-outgoing__"
const PHANTOM_VALUE_RATIO = 1e-6
const isPhantomId = (id: string) => id.startsWith("__phantom-")

// Maps the data's raw unit codes to a human-readable label used as the suffix
// in formatted output (e.g. "5 million tonnes"). An empty string means no
// suffix — relying on the chart title for context (e.g. for "No"-unit items
// like cigarettes).
const UNIT_LABEL: Record<string, string> = {
    t: "tonnes",
    An: "",
    No: "",
}

export const getUnitLabel = (unit: string): string => UNIT_LABEL[unit] ?? unit

export const formatTrade = (v: number, unit: string) =>
    formatValue(v, {
        unit: getUnitLabel(unit),
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

export function FoodTradeSankey({
    incoming,
    outgoing,
    country,
    unit,
}: {
    incoming: TradeRow[]
    outgoing: TradeRow[]
    country: string
    unit: string
}) {
    const { parentRef, width, height } = useParentSize()

    const { nodes, links, columnLabels } = useMemo(
        () => buildBidirectional(incoming, outgoing, country, unit, TOP_N),
        [incoming, outgoing, country, unit]
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
                    nodeColor={(n) =>
                        isPhantomId(n.id) ? "transparent" : SOURCE_COLOR
                    }
                    linkColor={(l) =>
                        isPhantomId(l.source) || isPhantomId(l.target)
                            ? "transparent"
                            : SOURCE_COLOR
                    }
                    formatValue={(v) => formatTrade(v, unit)}
                    columnLabels={columnLabels}
                />
            )}
        </div>
    )
}

// Pick the importers/exporters to show individually for one direction:
// top N, then drop those below SHARE_FLOOR. Always keep at least the top 1
// for pathologically flat distributions so we never show nothing.
function selectTopWithFloor(
    rows: TradeRow[],
    n: number
): { top: TradeRow[]; otherTotal: number; total: number } {
    const sorted = [...rows]
        .filter((d) => Number.isFinite(d.value) && d.value > 0)
        .sort((a, b) => b.value - a.value)
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

function buildBidirectional(
    incoming: TradeRow[],
    outgoing: TradeRow[],
    country: string,
    unit: string,
    n: number
): {
    nodes: SankeyNode[]
    links: SankeyLink[]
    columnLabels: (string | undefined)[]
} {
    const inSel = selectTopWithFloor(incoming, n)
    const outSel = selectTopWithFloor(outgoing, n)
    const hasIncoming = inSel.top.length > 0
    const hasOutgoing = outSel.top.length > 0

    const valueLabel = (value: number, sideTotal: number) =>
        sideTotal > 0
            ? `${formatTrade(value, unit)} (${formatPct((value / sideTotal) * 100)})`
            : formatTrade(value, unit)

    const nodes: SankeyNode[] = []
    const links: SankeyLink[] = []

    // Center node — its label is suppressed (the chart title names it).
    nodes.push({ id: country, label: "" })

    // Incoming side: senders → country
    // IDs are prefixed so a country that appears on both sides becomes two
    // distinct nodes (e.g. Mexico-as-sender vs Mexico-as-receiver).
    for (const d of inSel.top) {
        const id = `incoming:${d.exporter}`
        nodes.push({
            id,
            label: [d.exporter, valueLabel(d.value, inSel.total)],
        })
        links.push({ source: id, target: country, value: d.value })
    }
    if (inSel.otherTotal > 0) {
        const id = "__incoming-other__"
        nodes.push({ id, label: "Other" })
        links.push({ source: id, target: country, value: inSel.otherTotal })
    }

    // Outgoing side: country → receivers
    for (const d of outSel.top) {
        const id = `outgoing:${d.importer}`
        nodes.push({
            id,
            label: [d.importer, valueLabel(d.value, outSel.total)],
        })
        links.push({ source: country, target: id, value: d.value })
    }
    if (outSel.otherTotal > 0) {
        const id = "__outgoing-other__"
        nodes.push({ id, label: "Other" })
        links.push({ source: country, target: id, value: outSel.otherTotal })
    }

    // Pad with a phantom column on whichever side has no real data, so the
    // country stays at the visual midpoint and both column headers render.
    // Sized as a tiny fraction of the active side's real total so it stays
    // smaller than the real data even when totals are very small.
    const hasAnyData = hasIncoming || hasOutgoing
    const phantomValue =
        Math.max(inSel.total, outSel.total) * PHANTOM_VALUE_RATIO
    if (hasAnyData && !hasIncoming) {
        nodes.unshift({ id: PHANTOM_INCOMING_ID, label: "" })
        links.unshift({
            source: PHANTOM_INCOMING_ID,
            target: country,
            value: phantomValue,
        })
    }
    if (hasAnyData && !hasOutgoing) {
        nodes.push({ id: PHANTOM_OUTGOING_ID, label: "" })
        links.push({
            source: country,
            target: PHANTOM_OUTGOING_ID,
            value: phantomValue,
        })
    }

    // Column headers — when there's any data, always show both so the chart
    // structure stays consistent across products. The empty side gets a
    // "No imports" / "No exports" label that visually distinguishes it from
    // the arrow-bearing labels of the active side.
    const columnLabels: (string | undefined)[] = hasAnyData
        ? [
              hasIncoming ? "Imports from →" : "No imports",
              undefined,
              hasOutgoing ? "Exports to →" : "No exports",
          ]
        : []

    return { nodes, links, columnLabels }
}
