import { useMemo } from "react"
import { useParentSize } from "@visx/responsive"
import * as R from "remeda"

import { articulateEntity, formatValue } from "@ourworldindata/utils"
import { OwidVariableRoundingMode } from "@ourworldindata/types"

import { BilateralFlowSankey } from "../../../../components/Sankey/BilateralFlowSankey.js"
import {
    SplitFlowSankey,
    STACKED_BREAKPOINT_PX,
} from "../../../../components/Sankey/SplitFlowSankey.js"

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

    // When both halves are visible side-by-side the two headings read as one
    // sentence: "{country} imports X" + "and exports Y". In single-half
    // views — and when the halves stack vertically on narrow containers,
    // since the "and …" half then floats below its leading clause — the
    // exports heading switches to a standalone phrasing.
    const countryArticulated = articulateEntity(country)
    const isStacked = width > 0 && width < STACKED_BREAKPOINT_PX
    const isPairedSentence = view === "both" && !isStacked
    const incomingHeading =
        incomingFlows.length > 0
            ? `→ ${R.capitalize(countryArticulated)} imported ${formatTrade(incomingTotal)}`
            : isPairedSentence
              ? `${R.capitalize(countryArticulated)} imported none`
              : view === "both"
                ? `${R.capitalize(countryArticulated)} imported none`
                : "No imports"
    const outgoingHeading =
        outgoingFlows.length > 0
            ? isPairedSentence
                ? `and exported ${formatTrade(outgoingTotal)} →`
                : `${R.capitalize(countryArticulated)} exported ${formatTrade(outgoingTotal)} →`
            : isPairedSentence
              ? "and exported none"
              : view === "both"
                ? `${R.capitalize(countryArticulated)} exported none`
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
