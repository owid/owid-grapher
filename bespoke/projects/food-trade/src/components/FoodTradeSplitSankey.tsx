import { useCallback, useMemo } from "react"
import { useParentSize } from "@visx/responsive"
import * as R from "remeda"

import { articulateEntity } from "@ourworldindata/utils"
import {
    TooltipTable,
    TooltipValue,
} from "@ourworldindata/grapher/src/tooltip/TooltipContents.js"

import {
    getEntityShortLabel,
    EntityTotal,
} from "../../../../components/Sankey/helpers.js"
import { SankeyTooltip } from "../../../../components/Sankey/Sankey.js"
import {
    SankeyHalfTooltipArgs,
    SankeyHalfHeading,
    SplitFlowSankey,
    MOBILE_BREAKPOINT,
} from "../../../../components/Sankey/SplitFlowSankey.js"

import { type TradeRow } from "../data.js"
import { formatShare, formatTrade, shareAnnotation, tradeToFlow } from "../helpers.js"

// Show all rows up to this count instead of capping at TOP_N — avoids
// "+1 more country" type lines that read noisier than just listing the
// extra one or two countries.
const OTHER_BREAKDOWN_TOP_N = 8
const OTHER_BREAKDOWN_SHOW_ALL_BELOW = 10

export function FoodTradeSplitSankey({
    incoming,
    outgoing,
    country,
    product,
    year,
    countryProduction,
    countrySupply,
    view = "both",
    setView,
}: {
    incoming: TradeRow[]
    outgoing: TradeRow[]
    country: string
    product: string
    year: number
    /** Denominators for the share-of-production / share-of-supply
     *  parentheticals in the headings. Undefined when production/supply
     *  data is missing — the heading drops the parenthetical. */
    countryProduction?: number
    countrySupply?: number
    /** Which halves to show. Single-half views drop their heading and take
     * the full width. */
    view?: "both" | "imports" | "exports"
    /** Lets the empty-half CTA flip the user to the half that has data. */
    setView: (view: "both" | "imports" | "exports") => void
}) {
    const { parentRef, width, height } = useParentSize()

    const incomingFlows = useMemo(() => tradeToFlow(incoming), [incoming])
    const outgoingFlows = useMemo(() => tradeToFlow(outgoing), [outgoing])

    const incomingTotal = useMemo(
        () => R.sumBy(incoming, (d) => d.value),
        [incoming]
    )
    const outgoingTotal = useMemo(
        () => R.sumBy(outgoing, (d) => d.value),
        [outgoing]
    )
    const incomingShare =
        countrySupply && countrySupply > 0
            ? incomingTotal / countrySupply
            : undefined
    const outgoingShare =
        countryProduction && countryProduction > 0
            ? outgoingTotal / countryProduction
            : undefined

    // When both halves are visible side-by-side AND both have data, the
    // two headings read as one sentence: "{country} imports X" + "and
    // exports Y". In single-half views, when the halves stack vertically
    // on narrow containers, or when one half is empty (its heading is
    // suppressed in favour of a centered "didn't import/export" message),
    // the surviving heading switches to a standalone phrasing.
    // Heading uses the short name (e.g. "USA" instead of "United States")
    // but keeps the "the" article when the full name calls for one — so
    // "the United States" becomes "the USA" rather than dropping the article.
    const countryShort = getEntityShortLabel(country)
    const countryArticulated =
        articulateEntity(country) === country
            ? countryShort
            : `the ${countryShort}`
    const productLc = R.uncapitalize(product)
    const isStacked = width > 0 && width < MOBILE_BREAKPOINT
    const format = useCallback(
        (v: number) => formatTrade(v, { short: isStacked }),
        [isStacked]
    )
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
    const incomingHeading: SankeyHalfHeading =
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
    const outgoingHeading: SankeyHalfHeading =
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

    // Same percent denominator as the partner node labels (half total), so
    // the tooltip number matches what's already visible on the chart.
    const renderIncomingTooltip = useCallback(
        (args: SankeyHalfTooltipArgs) =>
            tradeLinkTooltip({
                exporter: args.partner,
                importer: country,
                value: args.value,
                halfTotal: incomingTotal,
                year,
                otherBreakdown: args.otherBreakdown,
            }),
        [country, incomingTotal, year]
    )
    const renderOutgoingTooltip = useCallback(
        (args: SankeyHalfTooltipArgs) =>
            tradeLinkTooltip({
                exporter: country,
                importer: args.partner,
                value: args.value,
                halfTotal: outgoingTotal,
                year,
                otherBreakdown: args.otherBreakdown,
            }),
        [country, outgoingTotal, year]
    )

    return (
        <div
            ref={parentRef}
            className={`food-trade-sankey${
                isSingleHalf ? " food-trade-sankey--single" : ""
            }`}
        >
            <SplitFlowSankey
                centralEntity={country}
                incoming={{
                    rows: incomingFlows,
                    heading: incomingHeading,
                    empty: incomingEmpty,
                    getTooltip: renderIncomingTooltip,
                }}
                outgoing={{
                    rows: outgoingFlows,
                    heading: outgoingHeading,
                    empty: outgoingEmpty,
                    getTooltip: renderOutgoingTooltip,
                }}
                width={width}
                height={height}
                formatValue={format}
                view={splitView}
            />
        </div>
    )
}

function tradeLinkTooltip({
    exporter,
    importer,
    value,
    halfTotal,
    year,
    otherBreakdown,
}: {
    exporter: string
    importer: string
    value: number
    halfTotal: number
    year: number
    otherBreakdown?: EntityTotal[]
}): SankeyTooltip {
    const isOther = !!otherBreakdown
    // For Other links, replace the "Country → Country" arrow with a short
    // noun phrase naming the long-tail bucket. Which role (exporters /
    // importers) is determined by which side of the link carries the bare
    // "Other" partner key.
    const title = isOther
        ? exporter === "Other"
            ? "Other exporters"
            : "Other importers"
        : `${getEntityShortLabel(exporter)} → ${getEntityShortLabel(importer)}`

    const share = halfTotal > 0 ? value / halfTotal : 0
    const formattedShare = formatShare(share)
    return {
        title,
        subtitle: String(year),
        content: isOther ? (
            <OtherBreakdownContent breakdown={otherBreakdown} />
        ) : (
            <TooltipValue
                value={
                    <span>
                        {formatTrade(value)}
                        {formattedShare && ` (${formattedShare})`}
                    </span>
                }
            />
        ),
    }
}

function OtherBreakdownContent({ breakdown }: { breakdown: EntityTotal[] }) {
    const showAll = breakdown.length <= OTHER_BREAKDOWN_SHOW_ALL_BELOW
    const visible = showAll
        ? breakdown
        : breakdown.slice(0, OTHER_BREAKDOWN_TOP_N)
    const hiddenCount = breakdown.length - visible.length

    const columns = [
        {
            label: "tonnes",
            formatValue: (v: unknown) =>
                typeof v === "number" ? formatTrade(v) : "",
        },
    ]
    const rows = visible.map((d) => ({
        name: getEntityShortLabel(d.entity),
        values: [d.total],
    }))

    return (
        <>
            <TooltipTable columns={columns} rows={rows} />
            {hiddenCount > 0 && (
                <div className="food-trade-sankey__tooltip-more">
                    + {hiddenCount} more{" "}
                    {hiddenCount === 1 ? "country" : "countries"}
                </div>
            )}
        </>
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
