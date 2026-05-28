import { useCallback, useMemo } from "react"
import { useParentSize } from "@visx/responsive"
import * as R from "remeda"

import { articulateEntity, formatValue } from "@ourworldindata/utils"
import { OwidVariableRoundingMode } from "@ourworldindata/types"
import {
    TooltipTable,
    TooltipValue,
} from "@ourworldindata/grapher/src/tooltip/TooltipContents.js"

import {
    getEntityShortLabel,
    EntityTotal,
    Flow,
} from "../../../../components/Sankey/helpers.js"

import {
    LinkSide,
    SankeyTooltip,
} from "../../../../components/Sankey/Sankey.js"
import {
    BilateralFlowSankey,
    BilateralTooltipArgs,
} from "../../../../components/Sankey/BilateralFlowSankey.js"
import {
    SankeyHalfTooltipArgs,
    SankeyHalfHeading,
    SplitFlowSankey,
    MOBILE_BREAKPOINT,
} from "../../../../components/Sankey/SplitFlowSankey.js"

import { type TradeRow } from "../data.js"

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

// Show all rows up to this count instead of capping at TOP_N — avoids
// "+1 more country" type lines that read noisier than just listing the
// extra one or two countries.
const OTHER_BREAKDOWN_TOP_N = 8
const OTHER_BREAKDOWN_SHOW_ALL_BELOW = 10

// Bilateral importer table uses a tighter cap — the table is per exporter,
// and the chart already names the most-significant ones. show-all is set to
// top_n + 2 so we never end up with a "+1 / +2 more" line (just show all).
const BILATERAL_TOP_N = 8
const BILATERAL_SHOW_ALL_BELOW = 10

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

export function FoodTradeBilateralSankey({
    rows,
    year,
    onSelectEntity,
}: {
    rows: TradeRow[]
    year: number
    /** Click on a column label/band selects that entity. Side determines
     *  whether the centered view opens on imports or exports. */
    onSelectEntity?: (entity: string, side: "exporter" | "importer") => void
}) {
    const { parentRef, width, height } = useParentSize()

    const flowRows = useMemo(() => tradeToFlow(rows), [rows])

    const getTooltip = useCallback(
        (args: BilateralTooltipArgs) => bilateralTooltip({ ...args, year }),
        [year]
    )

    // Translate `BilateralFlowSankey`'s neutral source/target back into
    // exporter/importer at the domain boundary.
    const handleSelect = onSelectEntity
        ? (entity: string, side: LinkSide) =>
              onSelectEntity(
                  entity,
                  side === "source" ? "exporter" : "importer"
              )
        : undefined

    return (
        <div ref={parentRef} className="food-trade-sankey">
            <BilateralFlowSankey
                flows={flowRows}
                width={width}
                height={height}
                formatValue={formatTrade}
                getTooltip={getTooltip}
                onSelectEntity={handleSelect}
            />
        </div>
    )
}

function bilateralTooltip({
    side,
    entity,
    partners,
    flows,
    year,
}: BilateralTooltipArgs & { year: number }): SankeyTooltip {
    const isOther = entity === "Other"
    // In trade terms: source-side hover = exporter, target-side = importer.
    // Named country: title is its name, subtitle scopes it
    // ("Exports in 2024" or "Imports in 2024"). Other bucket: title
    // names *which side* of the chart is the small one — the left and
    // right Other ribbons aren't symmetric (they reflect the source and
    // target Other buckets independently), so making the role explicit
    // disambiguates what each tooltip is listing.
    const isExporterSide = side === "source"
    const otherTitle = isExporterSide ? "Other exporters" : "Other importers"
    const title = isOther ? otherTitle : getEntityShortLabel(entity)
    const subtitle = isOther
        ? String(year)
        : isExporterSide
          ? `Exports in ${year}`
          : `Imports in ${year}`

    // Other bucket: one row per small country in the bucket, value = the
    // country's total trade in that role (exports for the left Other,
    // imports for the right). Reads as "here are the countries grouped
    // into Other and how much each one trades" — clearer than listing
    // raw trade pairs, and parallel in shape to the named-country body.
    // Named country: one row per partner — the redundant side is implicit
    // from the title.
    const visibleItems = isOther
        ? capItems(bucketTotalsBySmallSide(flows, side))
        : capItems(
              partners.map((p) => ({
                  name: getEntityShortLabel(p.entity),
                  value: p.total,
              }))
          )
    const overflowNoun = "countries"

    const columns = [
        {
            label: "tonnes",
            formatValue: (v: unknown) =>
                typeof v === "number" ? formatTrade(v) : "",
        },
    ]
    const tableRows = visibleItems.visible.map((d) => ({
        name: d.name,
        values: [d.value],
    }))

    return {
        title,
        subtitle,
        content: (
            <>
                <TooltipTable columns={columns} rows={tableRows} />
                {visibleItems.hiddenCount > 0 && (
                    <div className="food-trade-sankey__tooltip-more">
                        + {visibleItems.hiddenCount} more {overflowNoun}
                    </div>
                )}
            </>
        ),
    }
}

function capItems<T>(items: T[]): { visible: T[]; hiddenCount: number } {
    const showAll = items.length <= BILATERAL_SHOW_ALL_BELOW
    const visible = showAll ? items : items.slice(0, BILATERAL_TOP_N)
    return { visible, hiddenCount: items.length - visible.length }
}

// Aggregate raw trade rows by the small side of the hovered Other bucket
// (source for left Other, target for right Other), so each table row is
// one country in the bucket with its total trade in that role. Sorted
// desc by value.
function bucketTotalsBySmallSide(
    flows: Flow[],
    side: LinkSide
): { name: string; value: number }[] {
    const totals = new Map<string, number>()
    for (const r of flows) {
        const key = side === "source" ? r.source : r.target
        totals.set(key, (totals.get(key) ?? 0) + r.value)
    }
    return Array.from(totals.entries())
        .map(([name, value]) => ({ name: getEntityShortLabel(name), value }))
        .sort((a, b) => b.value - a.value)
}

export const formatTrade = (v: number, opts?: { short?: boolean }) =>
    formatValue(v, {
        unit: opts?.short ? "t" : "tonnes",
        numberAbbreviation: opts?.short ? "short" : "long",
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures: 2,
    })

// 2 significant figures via the shared OWID formatter. Returns "" for
// non-positive values so callers can drop the parenthetical entirely.
function formatShare(share: number): string {
    const pct = share * 100
    if (!isFinite(pct) || pct <= 0) return ""
    return formatValue(pct, {
        unit: "%",
        numberAbbreviation: false,
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures: 2,
    })
}

function shareAnnotation(
    share: number | undefined,
    kind: "production" | "supply"
): string | undefined {
    if (share === undefined) return undefined
    const formatted = formatShare(share)
    if (!formatted) return undefined
    return kind === "production"
        ? `${formatted} of its production`
        : `${formatted} of its domestic supply`
}

function tradeToFlow(rows: TradeRow[]) {
    return rows.map((r) => ({
        source: r.exporter,
        target: r.importer,
        value: r.value,
    }))
}
