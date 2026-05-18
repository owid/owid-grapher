import { useMemo } from "react"
import { useParentSize } from "@visx/responsive"

import { formatValue } from "@ourworldindata/utils"
import { OwidVariableRoundingMode } from "@ourworldindata/types"

import { BilateralFlowSankey } from "../../../../components/Sankey/BilateralFlowSankey.js"
import { SplitFlowSankey } from "../../../../components/Sankey/SplitFlowSankey.js"

import { TradeRow } from "../data.js"

export const TOP_N = 10

export const formatTrade = (v: number) =>
    formatValue(v, {
        unit: "tonnes",
        numberAbbreviation: "long",
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures: 2,
    })

function tradeToFlow(rows: TradeRow[]) {
    return rows.map((r) => ({
        source: r.exporter,
        target: r.importer,
        value: r.value,
    }))
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
    const { parentRef, width, height } = useParentSize()

    const incomingFlows = useMemo(() => tradeToFlow(incoming), [incoming])
    const outgoingFlows = useMemo(() => tradeToFlow(outgoing), [outgoing])

    // When both halves are visible the two headings read as one sentence:
    // "{country} imports X" + "and exports Y". In single-half views the
    // exports heading is rephrased to stand alone. Empty halves get a short
    // placeholder heading — sentence-fragment style in the both-view so the
    // halves still read together, standalone in single-half views.
    const incomingHeading =
        incomingFlows.length > 0
            ? `→ ${country} imported ${formatTrade(incomingTotal)}`
            : view === "both"
              ? `${country} imported none`
              : "No imports"
    const outgoingHeading =
        outgoingFlows.length > 0
            ? view === "both"
                ? `and exported ${formatTrade(outgoingTotal)} →`
                : `${country} exported ${formatTrade(outgoingTotal)} →`
            : view === "both"
              ? "and exported none"
              : "No exports"

    const splitView =
        view === "imports"
            ? "incoming"
            : view === "exports"
              ? "outgoing"
              : "both"
    const isSingleHalf = view !== "both"

    return (
        <div
            ref={parentRef}
            className={`food-trade-sankey${
                isSingleHalf ? " food-trade-sankey--single" : ""
            }`}
        >
            <SplitFlowSankey
                central={country}
                incoming={{
                    rows: incomingFlows,
                    heading: incomingHeading,
                }}
                outgoing={{
                    rows: outgoingFlows,
                    heading: outgoingHeading,
                }}
                width={width}
                height={height}
                formatValue={formatTrade}
                view={splitView}
                topN={TOP_N}
            />
        </div>
    )
}

export function FoodTradeBilateralSankey({ rows }: { rows: TradeRow[] }) {
    const { parentRef, width, height } = useParentSize()

    const flowRows = useMemo(() => tradeToFlow(rows), [rows])

    return (
        <div ref={parentRef} className="food-trade-sankey">
            <BilateralFlowSankey
                rows={flowRows}
                width={width}
                height={height}
                formatValue={formatTrade}
                topN={TOP_N}
            />
        </div>
    )
}
