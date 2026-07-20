import { useMemo, type ReactNode } from "react"
import { useParentSize } from "@visx/responsive"
import cx from "clsx"
import * as R from "remeda"
import { match } from "ts-pattern"

import { articulateEntity, Tippy } from "@ourworldindata/utils"
import {
    TooltipTable,
    TooltipValue,
} from "@ourworldindata/grapher/src/tooltip/TooltipContents.js"

import {
    EntityTotal,
    Flow,
    getEntityShortLabel,
    STACKED_MAX_NODES_TO_SHRINK_OTHER,
} from "../../../../components/Sankey/SankeyHelpers.js"
import { SankeyTooltip } from "../../../../components/Sankey/Sankey.js"
import { useTippyContainer } from "../../../../hooks/useTippyContainer.js"
import {
    DEFAULT_FONT_SETTINGS,
    MOBILE_BREAKPOINT,
    MOBILE_FONT_SETTINGS,
    SankeyHalfHeading,
    SankeyHalfTooltipArgs,
    SplitFlowSankey,
} from "../../../../components/Sankey/SplitFlowSankey.js"

import { MigrationFlow, MigrationView, Sex } from "../types.js"
import {
    capItems,
    formatPeople,
    formatShare,
    getSexAdjective,
    getSexNoun,
    OTHERS_ENTITY_NAME,
} from "../helpers.js"

// "Other countries" is a real aggregate row in the migration data, not a
// navigable country (the country dropdown filters it out), so it must never
// be selectable by clicking its Sankey node.
const NON_SELECTABLE_PARTNERS = new Set([OTHERS_ENTITY_NAME])

export function MigrationSankey({
    immigrants,
    emigrants,
    country,
    year,
    sex,
    immigrantsTotal,
    emigrantsTotal,
    population,
    view = "both",
    setView,
    setCountry,
    colorMap,
    entitiesToSortLast,
}: {
    immigrants: MigrationFlow[]
    emigrants: MigrationFlow[]
    country: string
    year: number
    sex: Sex
    immigrantsTotal: number
    emigrantsTotal: number
    population?: number
    view?: MigrationView
    setView: (view: MigrationView) => void
    setCountry: (name: string) => void
    colorMap?: Map<string, string>
    entitiesToSortLast?: string[]
}) {
    const { parentRef, width, height } = useParentSize()

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

    const isStacked = view === "both" && width > 0 && width < MOBILE_BREAKPOINT
    const noImmigrants = incomingFlows.length === 0
    const noEmigrants = outgoingFlows.length === 0
    const isPairedSentence =
        view === "both" && !isStacked && !noImmigrants && !noEmigrants

    const sharedHalfArgs = {
        country,
        year,
        view,
        isPairedSentence,
        sex,
        population,
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

    return (
        <div
            ref={parentRef}
            className={cx("migration-sankey", {
                "migration-sankey--single": view !== "both",
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
                onSelectPartner={setCountry}
                nonSelectablePartners={NON_SELECTABLE_PARTNERS}
                isStacked={isStacked}
                fontSettings={
                    isStacked ? MOBILE_FONT_SETTINGS : DEFAULT_FONT_SETTINGS
                }
                maxNodesToShrinkOther={
                    isStacked ? STACKED_MAX_NODES_TO_SHRINK_OTHER : undefined
                }
                entitiesToSortLast={entitiesToSortLast}
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
    sex,
    population,
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
    sex: Sex
    population?: number
    otherHasData: boolean
    setView: (view: MigrationView) => void
}) {
    const isIncoming = direction === "incoming"
    const ownView: MigrationView = isIncoming ? "immigrants" : "emigrants"
    const otherView: MigrationView = isIncoming ? "emigrants" : "immigrants"
    const arrowSide: "start" | "end" = isIncoming ? "start" : "end"

    const hasData = flows.length > 0

    const adjective = getSexAdjective(sex)

    const shortEntityName = getEntityShortLabel(country)
    const shortEntityNameWithArticle =
        articulateEntity(country) === country
            ? shortEntityName
            : `the ${shortEntityName}`

    const sexPrefix = adjective ? `${adjective} ` : ""
    const sexNoun = getSexNoun(adjective)

    const heading: SankeyHalfHeading = hasData
        ? {
              label: makeHeadingLabel({
                  direction,
                  total,
                  population,
                  shortEntityNameWithArticle,
                  isPairedSentence,
                  sexAdjective: adjective,
              }),
              arrowSide,
          }
        : {
              label: isIncoming
                  ? `No ${sexNoun} in ${shortEntityNameWithArticle} were born elsewhere`
                  : `No ${sexNoun} born in ${shortEntityNameWithArticle} live abroad`,
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
                        ? `No ${sexNoun} in ${R.capitalize(shortEntityNameWithArticle)} were born elsewhere in ${year}`
                        : `No ${sexNoun} born in ${R.capitalize(shortEntityNameWithArticle)} lived abroad in ${year}`
                    : isIncoming
                      ? `No ${sexPrefix}immigrants recorded in ${R.capitalize(shortEntityNameWithArticle)} in ${year}`
                      : `No ${sexPrefix}emigrants from ${R.capitalize(shortEntityNameWithArticle)} recorded in ${year}`
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
    population,
    shortEntityNameWithArticle,
    isPairedSentence,
    sexAdjective,
}: {
    direction: "incoming" | "outgoing"
    total: number
    population?: number
    shortEntityNameWithArticle: string
    isPairedSentence: boolean
    sexAdjective?: string
}): ReactNode {
    const peopleNoun = getSexNoun(sexAdjective)
    const count = (
        <PeopleCount
            direction={direction}
            total={total}
            population={population}
            shortEntityNameWithArticle={shortEntityNameWithArticle}
        />
    )
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

/**
 * The migrant count in a heading, with a tooltip that states the full number
 * and — when population is known — its share of the country's total population.
 *
 * Emigrants have left the country, so they aren't part of the resident
 * `population`. To express their share of the origin cohort (everyone born in
 * the country, whether they stayed or left) we add them back into the
 * denominator: emigrants / (population + emigrants). Immigrants are already
 * counted in the resident population, so they use it directly.
 */
function PeopleCount({
    direction,
    total,
    population,
    shortEntityNameWithArticle,
}: {
    direction: "incoming" | "outgoing"
    total: number
    population?: number
    shortEntityNameWithArticle: string
}): React.ReactElement {
    const { ref, getTippyContainer } = useTippyContainer<HTMLSpanElement>()

    const denominator =
        population === undefined
            ? undefined
            : direction === "outgoing"
              ? population + total
              : population
    const share =
        denominator && denominator > 0 ? total / denominator : undefined
    const formattedShare = share !== undefined ? formatShare(share) : ""

    const content = (
        <span className="migration-sankey__count-tooltip">
            <span className="migration-sankey__count-tooltip-value">
                {formatPeople(total)}
            </span>
            {formattedShare && (
                <span className="migration-sankey__count-tooltip-share">
                    {formattedShare} of the population of{" "}
                    {shortEntityNameWithArticle}
                </span>
            )}
        </span>
    )

    return (
        <Tippy content={content} appendTo={getTippyContainer} placement="top">
            <span ref={ref} className="migration-sankey__count" tabIndex={0}>
                {formatPeople(total, { unit: false })}
            </span>
        </Tippy>
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

    const otherTitle =
        direction === "incoming" ? "Other origins" : "Other destinations"
    const title = isOther
        ? otherTitle
        : direction === "incoming"
          ? `${partner} → ${central}`
          : `${central} → ${partner}`

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
