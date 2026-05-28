import { useCallback, useMemo } from "react"
import { useParentSize } from "@visx/responsive"

import { articulateEntity } from "@ourworldindata/utils"
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

import { MigrationFlow, MigrationView } from "../types.js"
import { capItems, capitalize, formatPeople, formatShare } from "../helpers.js"

export const TOP_N = 10

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
    // right heading leads with "and …" so it reads as a continuation of
    // the left. In single-half views, stacked layouts, and one-side-empty
    // cases, both headings are standalone — no "and".
    const countryArticulated = articulateEntity(country)
    const isStacked = width > 0 && width < MOBILE_BREAKPOINT
    const noImmigrants = incomingFlows.length === 0
    const noEmigrants = outgoingFlows.length === 0
    const isPairedSentence =
        view === "both" && !isStacked && !noImmigrants && !noEmigrants
    const emigrantsPrefix = isPairedSentence ? "and " : ""

    const incomingHeading: SankeyHalfHeading = !noImmigrants
        ? {
              label: `${formatPeople(immigrantsTotal, { unit: false })} immigrants lived in ${countryArticulated}`,
              arrowSide: "start",
          }
        : {
              label:
                  view === "both"
                      ? `No immigrants lived in ${countryArticulated}`
                      : "No immigrants",
          }

    const outgoingHeading: SankeyHalfHeading = !noEmigrants
        ? {
              label: `${emigrantsPrefix}${formatPeople(emigrantsTotal, { unit: false })} emigrants from ${countryArticulated} lived abroad`,
              arrowSide: "end",
          }
        : {
              label:
                  view === "both"
                      ? `No emigrants from ${countryArticulated} lived abroad`
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
    // case MigrationChart short-circuits before we render at all.
    const incomingEmpty = noImmigrants ? (
        <EmptyHalf
            message={`No immigrants recorded in ${capitalize(countryArticulated)} in ${year}`}
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
            message={`No emigrants from ${capitalize(countryArticulated)} recorded in ${year}`}
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
    const { visible, hiddenCount } = capItems(breakdown)

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
