import { useMemo, type ReactNode } from "react"
import { useParentSize } from "@visx/responsive"
import cx from "classnames"
import * as R from "remeda"
import { match } from "ts-pattern"

import { articulateEntity } from "@ourworldindata/utils"
import {
    TooltipTable,
    TooltipValue,
} from "@ourworldindata/grapher/src/tooltip/TooltipContents.js"

import {
    EntityTotal,
    Flow,
    getEntityShortLabel,
} from "../../../../components/Sankey/helpers.js"
import { SankeyTooltip } from "../../../../components/Sankey/Sankey.js"
import {
    MOBILE_BREAKPOINT,
    SankeyHalfHeading,
    SankeyHalfTooltipArgs,
    SplitFlowSankey,
} from "../../../../components/Sankey/SplitFlowSankey.js"

import { Gender, MigrationFlow, MigrationView } from "../types.js"
import {
    capItems,
    formatPeople,
    formatShare,
    getGenderAdjective,
    getGenderNoun,
} from "../helpers.js"

export function MigrationSankey({
    immigrants,
    emigrants,
    country,
    year,
    gender,
    immigrantsTotal,
    emigrantsTotal,
    view = "both",
    setView,
    colorMap,
}: {
    immigrants: MigrationFlow[]
    emigrants: MigrationFlow[]
    country: string
    year: number
    gender: Gender
    /** Pre-computed totals used in the column headers. */
    immigrantsTotal: number
    emigrantsTotal: number
    /** Which halves to show. Single-half views drop their heading and take
     * the full width. */
    view?: MigrationView
    /** Lets the empty-half CTA flip the user to the half that has data. */
    setView: (view: MigrationView) => void
    /** Country-scoped partner → color map for stable colors across
     *  year/gender changes. Recomputed by the parent when country
     *  changes. */
    colorMap?: Map<string, string>
}) {
    const { parentRef, width, height } = useParentSize()

    // Convert filtered domain rows to the central-anchored Flow shape the
    // sankey expects. Memoized so SplitFlowSankey's downstream useMemo
    // doesn't rebuild on every render.
    const incomingFlows = useMemo(
        () =>
            immigrants.map<Flow>((f) => ({
                source: f.partner,
                target: country,
                value: f.value,
            })),
        [immigrants, country]
    )
    const outgoingFlows = useMemo(
        () =>
            emigrants.map<Flow>((f) => ({
                source: country,
                target: f.partner,
                value: f.value,
            })),
        [emigrants, country]
    )

    const isStacked = width > 0 && width < MOBILE_BREAKPOINT
    const noImmigrants = incomingFlows.length === 0
    const noEmigrants = outgoingFlows.length === 0
    // When both halves are visible side-by-side AND both have data, the
    // right heading leads with "and …" so it reads as a continuation of
    // the left. In single-half views, stacked layouts, and one-side-empty
    // cases, both headings are standalone — no "and".
    const isPairedSentence =
        view === "both" && !isStacked && !noImmigrants && !noEmigrants

    const sharedHalfArgs = {
        country,
        year,
        view,
        isPairedSentence,
        gender,
        setView,
    }

    const incomingHalf = buildSankeyHalf({
        ...sharedHalfArgs,
        direction: "incoming",
        flows: incomingFlows,
        total: immigrantsTotal,
        otherHasData: !noEmigrants,
    })
    const outgoingHalf = buildSankeyHalf({
        ...sharedHalfArgs,
        direction: "outgoing",
        flows: outgoingFlows,
        total: emigrantsTotal,
        otherHasData: !noImmigrants,
    })

    const splitView = match(view)
        .with("immigrants", () => "incoming" as const)
        .with("emigrants", () => "outgoing" as const)
        .with("both", () => "both" as const)
        .exhaustive()
    const isSingleHalf = view !== "both"

    return (
        <div
            ref={parentRef}
            className={cx("migration-sankey", {
                "migration-sankey--single": isSingleHalf,
            })}
        >
            <SplitFlowSankey
                centralEntity={country}
                incoming={incomingHalf}
                outgoing={outgoingHalf}
                width={width}
                height={height}
                formatValue={formatPeople}
                view={splitView}
                colorMap={colorMap}
            />
        </div>
    )
}

function buildSankeyHalf({
    direction,
    flows,
    total,
    country,
    year,
    view,
    isPairedSentence,
    gender,
    otherHasData,
    setView,
}: {
    direction: "incoming" | "outgoing"
    flows: Flow[]
    total: number
    country: string
    year: number
    view: MigrationView
    isPairedSentence: boolean
    gender: Gender
    /** Whether the other half has data — drives the empty-state CTA. */
    otherHasData: boolean
    setView: (view: MigrationView) => void
}) {
    const isIncoming = direction === "incoming"
    const ownView: MigrationView = isIncoming ? "immigrants" : "emigrants"
    const otherView: MigrationView = isIncoming ? "emigrants" : "immigrants"
    const arrowSide: "start" | "end" = isIncoming ? "start" : "end"

    const hasData = flows.length > 0

    const adjective = getGenderAdjective(gender)
    const headingAdjective =
        isPairedSentence && !isIncoming ? undefined : adjective

    // Heading uses the short name (e.g. "USA" instead of "United States") but
    // keeps the "the" article when the full name calls for one — so "the
    // United States" becomes "the USA" rather than dropping the article.
    const shortEntityName = getEntityShortLabel(country)
    const shortEntityNameWithArticle =
        articulateEntity(country) === country
            ? shortEntityName
            : `the ${shortEntityName}`

    const genderPrefix = adjective ? `${adjective} ` : ""
    const genderNoun = getGenderNoun(adjective)

    const heading: SankeyHalfHeading = hasData
        ? {
              label: makeHeadingLabel({
                  direction,
                  total,
                  shortEntityNameWithArticle,
                  isPairedSentence,
                  genderAdjective: headingAdjective,
                  view,
              }),
              arrowSide,
          }
        : {
              label:
                  view === "both"
                      ? isIncoming
                          ? `No ${genderNoun} in ${shortEntityNameWithArticle} were born elsewhere`
                          : `No ${genderNoun} born in ${shortEntityNameWithArticle} live abroad`
                      : isIncoming
                        ? `No ${genderPrefix}immigrants`
                        : `No ${genderPrefix}emigrants`,
          }

    const cta =
        view === ownView && otherHasData
            ? {
                  label: `See ${otherView}`,
                  onClick: () => setView(otherView),
              }
            : undefined

    const empty = !hasData ? (
        <EmptyHalf
            message={
                view === "both"
                    ? isIncoming
                        ? `No ${genderNoun} in ${R.capitalize(shortEntityNameWithArticle)} were born elsewhere in ${year}`
                        : `No ${genderNoun} born in ${R.capitalize(shortEntityNameWithArticle)} lived abroad in ${year}`
                    : isIncoming
                      ? `No ${genderPrefix}immigrants recorded in ${R.capitalize(shortEntityNameWithArticle)} in ${year}`
                      : `No ${genderPrefix}emigrants from ${R.capitalize(shortEntityNameWithArticle)} recorded in ${year}`
            }
            cta={cta}
        />
    ) : undefined

    const getTooltip = (args: SankeyHalfTooltipArgs) =>
        getMigrationLinkTooltip({
            direction,
            partner: args.partner,
            central: country,
            value: args.value,
            halfTotal: total,
            year,
            otherBreakdown: args.otherBreakdown,
        })

    return { rows: flows, heading, empty, getTooltip }
}

function makeHeadingLabel({
    direction,
    total,
    shortEntityNameWithArticle,
    isPairedSentence,
    genderAdjective,
    view,
}: {
    direction: "incoming" | "outgoing"
    total: number
    shortEntityNameWithArticle: string
    isPairedSentence: boolean
    genderAdjective?: string
    view: MigrationView
}): ReactNode {
    const count = formatPeople(total, { unit: false })
    const genderPrefix = genderAdjective ? `${genderAdjective} ` : ""
    if (view === "both") {
        const peopleNoun = getGenderNoun(genderAdjective)
        if (direction === "incoming") {
            return (
                <>
                    {count} {peopleNoun} in {shortEntityNameWithArticle} were{" "}
                    <strong className="split-flow-sankey__heading-emphasis">
                        born elsewhere
                    </strong>
                </>
            )
        }
        const prefix = isPairedSentence ? "and " : ""
        return (
            <>
                {prefix}
                {count} {peopleNoun} born in {shortEntityNameWithArticle}{" "}
                <strong className="split-flow-sankey__heading-emphasis">
                    live abroad
                </strong>
            </>
        )
    }
    if (direction === "incoming") {
        return `${count} ${genderPrefix}immigrants lived in ${shortEntityNameWithArticle}`
    }
    const prefix = isPairedSentence ? "and " : ""
    return `${prefix}${count} ${genderPrefix}emigrants from ${shortEntityNameWithArticle} lived abroad`
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
