import { useCallback, useMemo } from "react"
import { useParentSize } from "@visx/responsive"

import { articulateEntity, formatValue } from "@ourworldindata/utils"
import { OwidVariableRoundingMode } from "@ourworldindata/types"
import {
    TooltipTable,
    TooltipValue,
} from "@ourworldindata/grapher/src/tooltip/TooltipContents.js"

import {
    EntityTotal,
    getEntityShortLabel,
} from "../../../../components/Sankey/helpers.js"
import { SankeyTooltip } from "../../../../components/Sankey/Sankey.js"
import {
    MOBILE_BREAKPOINT,
    SankeyHalfHeading,
    SankeyHalfTooltipArgs,
    SplitFlowSankey,
} from "../../../../components/Sankey/SplitFlowSankey.js"

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

export const TOP_N = 10

// Caps for the Other-bucket tooltip table — mirror food-trade's tooltip
// caps. show-all kicks in just two above the cap so we never get a
// "+1 / +2 more" line.
const OTHER_BREAKDOWN_TOP_N = 8
const OTHER_BREAKDOWN_SHOW_ALL_BELOW = 10

export type MigrationFlow = {
    /** Origin (immigrants) or destination (emigrants) country name. */
    partner: string
    value: number
}

export type MigrationView = "both" | "immigrants" | "emigrants"

export const formatPeople = (v: number) =>
    formatValue(v, {
        unit: "people",
        numberAbbreviation: "long",
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures: 2,
    })

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

export function MigrationSankey({
    immigrants,
    emigrants,
    country,
    year,
    immigrantsTotal,
    emigrantsTotal,
    view = "both",
    setView,
}: {
    immigrants: MigrationFlow[]
    emigrants: MigrationFlow[]
    country: string
    year: number
    /** Pre-computed totals used in the column headers. */
    immigrantsTotal: number
    emigrantsTotal: number
    /** Which halves to show. Single-half views drop their heading and take
     * the full width. */
    view?: MigrationView
    /** Lets the empty-half CTA flip the user to the half that has data. */
    setView: (view: MigrationView) => void
}) {
    const { parentRef, width, height } = useParentSize()

    const incomingFlows = useMemo(
        () =>
            immigrants.map((f) => ({
                source: f.partner,
                target: country,
                value: f.value,
            })),
        [immigrants, country]
    )
    const outgoingFlows = useMemo(
        () =>
            emigrants.map((f) => ({
                source: country,
                target: f.partner,
                value: f.value,
            })),
        [emigrants, country]
    )

    // When both halves are visible side-by-side AND both have data, the
    // two headings read as one sentence: "{country} received X immigrants"
    // + "and sent Y emigrants in {year}". In single-half views, when the
    // halves stack vertically on narrow containers, or when one half is
    // empty (its heading is suppressed in favour of a centered "no
    // immigrants/emigrants" message), the surviving heading switches to a
    // standalone phrasing that carries the year on its own.
    const countryArticulated = articulateEntity(country)
    const isStacked = width > 0 && width < MOBILE_BREAKPOINT
    const noImmigrants = incomingFlows.length === 0
    const noEmigrants = outgoingFlows.length === 0
    const isPairedSentence =
        view === "both" && !isStacked && !noImmigrants && !noEmigrants

    const incomingHeading: SankeyHalfHeading = !noImmigrants
        ? {
              label: isPairedSentence
                  ? `${capitalize(countryArticulated)} received ${formatPeople(immigrantsTotal)} immigrants`
                  : `${capitalize(countryArticulated)} received ${formatPeople(immigrantsTotal)} immigrants in ${year}`,
              arrowSide: "start",
          }
        : {
              label: isPairedSentence
                  ? `${capitalize(countryArticulated)} received none`
                  : view === "both"
                    ? `${capitalize(countryArticulated)} received none`
                    : "No immigrants",
          }

    const outgoingHeading: SankeyHalfHeading = !noEmigrants
        ? {
              label: isPairedSentence
                  ? `and sent ${formatPeople(emigrantsTotal)} emigrants in ${year}`
                  : `${capitalize(countryArticulated)} sent ${formatPeople(emigrantsTotal)} emigrants in ${year}`,
              arrowSide: "end",
          }
        : {
              label: isPairedSentence
                  ? "and sent none"
                  : view === "both"
                    ? `${capitalize(countryArticulated)} sent none`
                    : "No emigrants",
          }

    const splitView =
        view === "immigrants"
            ? "incoming"
            : view === "emigrants"
              ? "outgoing"
              : "both"
    const isSingleHalf = view !== "both"

    // CTA shows up only in single-half views where the displayed half is
    // empty but the other direction has data. In both-view, the populated
    // half is already on screen so no CTA is needed; in the no-data-at-all
    // case MainVariant short-circuits before we render at all.
    const incomingEmpty = noImmigrants ? (
        <EmptyHalf
            message={`${capitalize(countryArticulated)} had no recorded immigrants in ${year}`}
            cta={
                view === "immigrants" && !noEmigrants
                    ? {
                          label: "See emigrants",
                          onClick: () => setView("emigrants"),
                      }
                    : undefined
            }
        />
    ) : undefined
    const outgoingEmpty = noEmigrants ? (
        <EmptyHalf
            message={`${capitalize(countryArticulated)} had no recorded emigrants in ${year}`}
            cta={
                view === "emigrants" && !noImmigrants
                    ? {
                          label: "See immigrants",
                          onClick: () => setView("immigrants"),
                      }
                    : undefined
            }
        />
    ) : undefined

    // Same denominator as the partner-node label percentages (half total),
    // so the tooltip's share matches the number already shown on the chart.
    const renderIncomingTooltip = useCallback(
        (args: SankeyHalfTooltipArgs) =>
            getMigrationLinkTooltip({
                direction: "incoming",
                partner: args.partner,
                central: country,
                value: args.value,
                halfTotal: immigrantsTotal,
                year,
                otherBreakdown: args.otherBreakdown,
            }),
        [country, immigrantsTotal, year]
    )
    const renderOutgoingTooltip = useCallback(
        (args: SankeyHalfTooltipArgs) =>
            getMigrationLinkTooltip({
                direction: "outgoing",
                partner: args.partner,
                central: country,
                value: args.value,
                halfTotal: emigrantsTotal,
                year,
                otherBreakdown: args.otherBreakdown,
            }),
        [country, emigrantsTotal, year]
    )

    return (
        <div
            ref={parentRef}
            className={`migration-sankey${
                isSingleHalf ? " migration-sankey--single" : ""
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
                formatValue={formatPeople}
                view={splitView}
                topN={TOP_N}
            />
        </div>
    )
}

function getMigrationLinkTooltip({
    direction,
    partner,
    central,
    value,
    halfTotal,
    year,
    otherBreakdown,
}: {
    direction: "incoming" | "outgoing"
    partner: string
    central: string
    value: number
    halfTotal: number
    year: number
    otherBreakdown?: EntityTotal[]
}): SankeyTooltip {
    const isOther = !!otherBreakdown

    // For "Other" links, replace the "Country → Country" arrow with a
    // short noun phrase naming the long-tail bucket. Which role
    // (origins / destinations) is determined by the half's direction.
    const otherTitle =
        direction === "incoming" ? "Other origins" : "Other destinations"
    const title = isOther
        ? otherTitle
        : direction === "incoming"
          ? `${getEntityShortLabel(partner)} → ${getEntityShortLabel(central)}`
          : `${getEntityShortLabel(central)} → ${getEntityShortLabel(partner)}`

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
                        {formatPeople(value)}
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
            label: "people",
            formatValue: (v: unknown) =>
                typeof v === "number" ? formatPeople(v) : "",
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
                <div className="migration-sankey__tooltip-more">
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
        <div className="migration-sankey__empty-half">
            <p className="migration-sankey__empty-half-message">{message}</p>
            {cta && (
                <button
                    type="button"
                    className="migration-sankey__empty-half-cta"
                    onClick={cta.onClick}
                >
                    {cta.label} →
                </button>
            )}
        </div>
    )
}
