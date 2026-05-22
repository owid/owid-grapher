import { useMemo } from "react"
import { useParentSize } from "@visx/responsive"
import * as R from "remeda"

import { articulateEntity, formatValue } from "@ourworldindata/utils"
import { OwidVariableRoundingMode } from "@ourworldindata/types"

import { BilateralFlowSankey } from "../../../../components/Sankey/BilateralFlowSankey.js"
import {
    HeadingContent,
    SplitFlowSankey,
    STACKED_BREAKPOINT_PX,
} from "../../../../components/Sankey/SplitFlowSankey.js"

import { TradeRow } from "../data.js"

export const formatTrade = (v: number) =>
    formatValue(v, {
        unit: "tonnes",
        numberAbbreviation: "long",
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures: 2,
    })

// 2 significant figures, no trailing zeros. >=10% rounds to whole percent so
// numbers near 100% don't read as "1.0e+2%". toPrecision(2) handles the rest
// (17 → "17", 0.2 → "0.20" → parseFloat → "0.2").
function formatShare(share: number): string {
    const pct = share * 100
    if (!isFinite(pct) || pct <= 0) return ""
    if (pct >= 10) return `${Math.round(pct)}%`
    return `${parseFloat(pct.toPrecision(2))}%`
}

function shareAnnotation(
    share: number | undefined,
    kind: "production" | "supply"
): string | undefined {
    if (share === undefined) return undefined
    const formatted = formatShare(share)
    if (!formatted) return undefined
    return kind === "production"
        ? `(${formatted} of its production)`
        : `(${formatted} of its domestic supply)`
}

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
    product,
    year,
    incomingTotal,
    outgoingTotal,
    incomingShare,
    outgoingShare,
    view = "both",
    setView,
}: {
    incoming: TradeRow[]
    outgoing: TradeRow[]
    country: string
    product: string
    year: number
    /** Pre-computed totals used in the column headers. */
    incomingTotal: number
    outgoingTotal: number
    /** Pre-computed shares (0–1). Imports as a share of domestic supply,
     * exports as a share of production. Undefined when production/supply
     * data is missing — the heading drops the parenthetical in that case. */
    incomingShare?: number
    outgoingShare?: number
    /** Which halves to show. Single-half views drop their heading and take
     * the full width. */
    view?: "both" | "imports" | "exports"
    /** Lets the empty-half CTA flip the user to the half that has data. */
    setView: (view: "both" | "imports" | "exports") => void
}) {
    const { parentRef, width, height } = useParentSize()

    const incomingFlows = useMemo(() => tradeToFlow(incoming), [incoming])
    const outgoingFlows = useMemo(() => tradeToFlow(outgoing), [outgoing])

    // When both halves are visible side-by-side AND both have data, the
    // two headings read as one sentence: "{country} imports X" + "and
    // exports Y". In single-half views, when the halves stack vertically
    // on narrow containers, or when one half is empty (its heading is
    // suppressed in favour of a centered "didn't import/export" message),
    // the surviving heading switches to a standalone phrasing.
    const countryArticulated = articulateEntity(country)
    const productLc = R.uncapitalize(product)
    const isStacked = width > 0 && width < STACKED_BREAKPOINT_PX
    const noImports = incomingFlows.length === 0
    const noExports = outgoingFlows.length === 0
    const isPairedSentence =
        view === "both" && !isStacked && !noImports && !noExports
    // Paired sentence omits the product on the incoming clause — it shows
    // up once at the tail of the outgoing clause. Standalone clauses
    // (single-half view, stacked, or one half empty) carry the product
    // each.
    const incomingAnnotation = shareAnnotation(incomingShare, "supply")
    const outgoingAnnotation = shareAnnotation(outgoingShare, "production")
    const incomingHeading: HeadingContent =
        incomingFlows.length > 0
            ? {
                  label: isPairedSentence
                      ? `${R.capitalize(countryArticulated)} imported ${formatTrade(incomingTotal)}`
                      : `${R.capitalize(countryArticulated)} imported ${formatTrade(incomingTotal)} of ${productLc}`,
                  annotation: incomingAnnotation,
                  arrowSide: "start",
              }
            : {
                  label: isPairedSentence
                      ? `${R.capitalize(countryArticulated)} imported none`
                      : view === "both"
                        ? `${R.capitalize(countryArticulated)} imported none`
                        : "No imports",
              }
    const outgoingHeading: HeadingContent =
        outgoingFlows.length > 0
            ? {
                  label: isPairedSentence
                      ? `and exported ${formatTrade(outgoingTotal)} of ${productLc}`
                      : `${R.capitalize(countryArticulated)} exported ${formatTrade(outgoingTotal)} of ${productLc}`,
                  annotation: outgoingAnnotation,
                  arrowSide: "end",
              }
            : {
                  label: isPairedSentence
                      ? "and exported none"
                      : view === "both"
                        ? `${R.capitalize(countryArticulated)} exported none`
                        : "No exports",
              }

    const splitView =
        view === "imports"
            ? "incoming"
            : view === "exports"
              ? "outgoing"
              : "both"
    const isSingleHalf = view !== "both"

    // CTA shows up only in single-half views where the displayed half is
    // empty but the other direction has data. In both-view, the populated
    // half is already on screen so no CTA is needed; in the no-data-at-all
    // case MainVariant short-circuits before we render at all.
    const incomingEmpty = noImports ? (
        <EmptyHalf
            message={`${R.capitalize(countryArticulated)} didn't import ${R.uncapitalize(product)} in ${year}`}
            cta={
                view === "imports" && !noExports
                    ? {
                          label: "See exports",
                          onClick: () => setView("exports"),
                      }
                    : undefined
            }
        />
    ) : undefined
    const outgoingEmpty = noExports ? (
        <EmptyHalf
            message={`${R.capitalize(countryArticulated)} didn't export ${R.uncapitalize(product)} in ${year}`}
            cta={
                view === "exports" && !noImports
                    ? {
                          label: "See imports",
                          onClick: () => setView("imports"),
                      }
                    : undefined
            }
        />
    ) : undefined

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
                    empty: incomingEmpty,
                }}
                outgoing={{
                    rows: outgoingFlows,
                    heading: outgoingHeading,
                    empty: outgoingEmpty,
                }}
                width={width}
                height={height}
                formatValue={formatTrade}
                view={splitView}
            />
        </div>
    )
}

function EmptyHalf({
    message,
    cta,
}: {
    message: string
    cta?: { label: string; onClick: () => void }
}): React.ReactElement {
    return (
        <div className="food-trade-sankey__empty-half">
            <p className="food-trade-sankey__empty-half-message">{message}</p>
            {cta && (
                <button
                    type="button"
                    className="food-trade-sankey__empty-half-cta"
                    onClick={cta.onClick}
                >
                    {cta.label} →
                </button>
            )}
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
            />
        </div>
    )
}
