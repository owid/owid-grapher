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
const OTHER_NODE_ID = "__other__"
const SOURCE_COLOR = OwidDistinctColors.Denim

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
    data,
    exporter,
    unit,
}: {
    data: TradeRow[]
    exporter: string
    unit: string
}) {
    const { parentRef, width, height } = useParentSize()

    const { nodes, links } = useMemo(
        () => buildTopNWithOther(data, exporter, unit, TOP_N),
        [data, exporter, unit]
    )

    return (
        <div ref={parentRef} className="food-trade-sankey">
            {width > 0 && height > 0 && (
                <Sankey
                    nodes={nodes}
                    links={links}
                    width={width}
                    height={height}
                    margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                    nodeColor={() => SOURCE_COLOR}
                    linkColor={() => SOURCE_COLOR}
                    formatValue={(v) => formatTrade(v, unit)}
                />
            )}
        </div>
    )
}

function buildTopNWithOther(
    data: TradeRow[],
    exporter: string,
    unit: string,
    n: number
): { nodes: SankeyNode[]; links: SankeyLink[] } {
    const sorted = [...data]
        .filter((d) => Number.isFinite(d.value) && d.value > 0)
        .sort((a, b) => b.value - a.value)
    const total = sorted.reduce((sum, d) => sum + d.value, 0)

    // Cap at top N, then drop entries below the share floor. Always keep at
    // least the top 1 so a pathologically flat distribution still shows
    // something individually.
    const topCandidates = sorted.slice(0, n)
    const aboveFloor = topCandidates.filter(
        (d) => total > 0 && d.value / total >= SHARE_FLOOR
    )
    const top = aboveFloor.length > 0 ? aboveFloor : topCandidates.slice(0, 1)

    const rest = sorted.slice(top.length)
    const otherTotal = rest.reduce((sum, d) => sum + d.value, 0)

    const valueLabel = (value: number) =>
        total > 0
            ? `${formatTrade(value, unit)} (${formatPct((value / total) * 100)})`
            : formatTrade(value, unit)

    const nodes: SankeyNode[] = [
        // Source label is suppressed — the chart title already names the exporter.
        { id: exporter, label: "" },
        ...top.map((d) => ({
            id: d.importer,
            label: [d.importer, valueLabel(d.value)],
        })),
    ]
    const links: SankeyLink[] = top.map((d) => ({
        source: exporter,
        target: d.importer,
        value: d.value,
    }))

    if (rest.length > 0) {
        nodes.push({
            id: OTHER_NODE_ID,
            label: "Other",
        })
        links.push({
            source: exporter,
            target: OTHER_NODE_ID,
            value: otherTotal,
        })
    }

    return { nodes, links }
}
