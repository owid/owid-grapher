import { useMemo } from "react"
import { useParentSize } from "@visx/responsive"

import { articulateEntity, formatValue } from "@ourworldindata/utils"
import { OwidVariableRoundingMode } from "@ourworldindata/types"

import {
    SplitFlowSankey,
    STACKED_BREAKPOINT_PX,
} from "../../../../components/Sankey/SplitFlowSankey.js"

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

export const TOP_N = 10

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
    const isStacked = width > 0 && width < STACKED_BREAKPOINT_PX
    const noImmigrants = incomingFlows.length === 0
    const noEmigrants = outgoingFlows.length === 0
    const isPairedSentence =
        view === "both" && !isStacked && !noImmigrants && !noEmigrants

    const incomingHeading = !noImmigrants
        ? isPairedSentence
            ? `→ ${capitalize(countryArticulated)} received ${formatPeople(immigrantsTotal)} immigrants`
            : `→ ${capitalize(countryArticulated)} received ${formatPeople(immigrantsTotal)} immigrants in ${year}`
        : isPairedSentence
          ? `${capitalize(countryArticulated)} received none`
          : view === "both"
            ? `${capitalize(countryArticulated)} received none`
            : "No immigrants"
    const outgoingHeading = !noEmigrants
        ? isPairedSentence
            ? `and sent ${formatPeople(emigrantsTotal)} emigrants in ${year} →`
            : `${capitalize(countryArticulated)} sent ${formatPeople(emigrantsTotal)} emigrants in ${year} →`
        : isPairedSentence
          ? "and sent none"
          : view === "both"
            ? `${capitalize(countryArticulated)} sent none`
            : "No emigrants"

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

    return (
        <div
            ref={parentRef}
            className={`migration-sankey${
                isSingleHalf ? " migration-sankey--single" : ""
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
                formatValue={formatPeople}
                view={splitView}
                topN={TOP_N}
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
