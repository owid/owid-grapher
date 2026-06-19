import { useCallback, useMemo, type ReactNode } from "react"
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
    getEntityShortLabel,
    EntityTotal,
    Flow,
} from "../../../../components/Sankey/SankeyHelpers.js"
import { SankeyTooltip } from "../../../../components/Sankey/Sankey.js"
import {
    SankeyHalfTooltipArgs,
    SankeyHalfHeading,
    SplitFlowSankey,
    MOBILE_BREAKPOINT,
    MOBILE_FONT_SETTINGS,
    DEFAULT_FONT_SETTINGS,
} from "../../../../components/Sankey/SplitFlowSankey.js"

import { type FoodTradeSankeySettings, type TradeRow } from "../types.js"
import {
    capItems,
    formatShare,
    formatTrade,
    tradesToFlows,
} from "../helpers.js"

export function FoodTradeSplitSankey({
    incomingTrades,
    outgoingTrades,
    country,
    product,
    year,
    sankeySettings,
    countryProduction,
    countrySupply,
    view = "both",
    setView,
}: {
    country: string
    product: string
    year: number
    sankeySettings: FoodTradeSankeySettings
    incomingTrades: TradeRow[]
    outgoingTrades: TradeRow[]
    countryProduction?: number
    countrySupply?: number
    view?: "both" | "import" | "export"
    setView: (view: "both" | "import" | "export") => void
}) {
    const { parentRef, width, height } = useParentSize()

    const incomingFlows = useMemo(
        () => tradesToFlows(incomingTrades),
        [incomingTrades]
    )
    const outgoingFlows = useMemo(
        () => tradesToFlows(outgoingTrades),
        [outgoingTrades]
    )

    const isStacked = view === "both" && width > 0 && width < MOBILE_BREAKPOINT
    const sharedArgsForBuildingSankeyHalves = {
        country,
        product,
        year,
        view,
        isStacked,
        setView,
    }

    const incomingHalf = buildSankeyHalf({
        ...sharedArgsForBuildingSankeyHalves,
        direction: "incoming",
        flows: incomingFlows,
        denominator: countrySupply,
        otherHasData: outgoingFlows.length > 0,
    })
    const outgoingHalf = buildSankeyHalf({
        ...sharedArgsForBuildingSankeyHalves,
        direction: "outgoing",
        flows: outgoingFlows,
        denominator: countryProduction,
        otherHasData: incomingFlows.length > 0,
    })

    const formatValue = useCallback(
        (v: number) => formatTrade(v, { short: isStacked }),
        [isStacked]
    )

    const splitView = match(view)
        .with("import", () => "incoming" as const)
        .with("export", () => "outgoing" as const)
        .with("both", () => "both" as const)
        .exhaustive()

    return (
        <div
            ref={parentRef}
            className={cx("food-trade-sankey", {
                "food-trade-sankey--single": view !== "both",
            })}
        >
            <SplitFlowSankey
                centralEntity={country}
                incoming={incomingHalf}
                outgoing={outgoingHalf}
                width={width}
                height={height}
                formatValue={formatValue}
                view={splitView}
                isStacked={isStacked}
                fontSettings={
                    isStacked ? MOBILE_FONT_SETTINGS : DEFAULT_FONT_SETTINGS
                }
                minNodes={sankeySettings.minNodes}
                maxNodes={sankeySettings.maxNodes}
                maxNodesToShrinkOther={sankeySettings.maxNodes}
                minNodeShare={sankeySettings.minNodeShare}
                shouldFadeSmallFlows={sankeySettings.shouldFadeSmallFlows}
            />
        </div>
    )
}

function buildSankeyHalf({
    direction,
    flows,
    denominator,
    country,
    product,
    year,
    view,
    isStacked,
    otherHasData,
    setView,
}: {
    direction: "incoming" | "outgoing"
    flows: Flow[]
    /** Production for outgoing, supply for incoming */
    denominator: number | undefined
    country: string
    product: string
    year: number
    view: "both" | "import" | "export"
    isStacked: boolean
    otherHasData: boolean
    setView: (view: "both" | "import" | "export") => void
}) {
    const isIncoming = direction === "incoming"
    const verbInf = isIncoming ? "import" : "export"
    const ownView: "import" | "export" = isIncoming ? "import" : "export"
    const otherView: "import" | "export" = isIncoming ? "export" : "import"
    // Plural noun for display text (the flow state values are singular)
    const otherNoun = isIncoming ? "exports" : "imports"
    const arrowSide: "start" | "end" = isIncoming ? "start" : "end"

    const hasData = flows.length > 0
    const total = R.sumBy(flows, (d) => d.value)
    const share =
        denominator && denominator > 0 ? total / denominator : undefined

    const shortEntityName = getEntityShortLabel(country)
    const shortEntityNameWithArticle =
        articulateEntity(country) === country
            ? shortEntityName
            : `the ${shortEntityName}`

    const annotation = makeAnnotation(
        share,
        isIncoming ? "supply" : "production"
    )

    const label = makeLabel({
        direction,
        flows,
        total,
        shortEntityNameWithArticle,
        view,
        isStacked,
        otherHasData,
    })

    const heading: SankeyHalfHeading = hasData
        ? { label, annotation, arrowSide }
        : { label }

    const cta =
        view === ownView && otherHasData
            ? {
                  label: `See ${otherNoun}`,
                  onClick: () => setView(otherView),
              }
            : undefined

    const empty = !hasData ? (
        <EmptyHalf
            message={`${R.capitalize(shortEntityNameWithArticle)} didn't ${verbInf} ${R.uncapitalize(product)} in ${year}`}
            cta={cta}
        />
    ) : undefined

    const getTooltip = (args: SankeyHalfTooltipArgs) =>
        getTradeLinkTooltip({
            exporter: isIncoming ? args.partner : country,
            importer: isIncoming ? country : args.partner,
            value: args.value,
            halfTotal: total,
            year,
            otherBreakdown: args.otherBreakdown,
        })

    return { rows: flows, heading, empty, getTooltip }
}

function makeLabel({
    direction,
    flows,
    total,
    shortEntityNameWithArticle,
    view,
    isStacked,
    otherHasData,
}: {
    direction: "incoming" | "outgoing"
    flows: Flow[]
    total: number
    shortEntityNameWithArticle: string
    view: "both" | "import" | "export"
    isStacked: boolean
    otherHasData: boolean
}): ReactNode {
    const isIncoming = direction === "incoming"
    const verb = isIncoming ? "imported" : "exported"
    const noun = isIncoming ? "imports" : "exports"
    const hasData = flows.length > 0

    // Paired sentence reads "X imported A and exported B of Y"
    const isPairedSentence =
        view === "both" && !isStacked && hasData && otherHasData

    const boldVerb = (
        <strong className="split-flow-sankey__heading-emphasis">{verb}</strong>
    )

    if (hasData) {
        if (isPairedSentence) {
            return isIncoming ? (
                <>
                    {R.capitalize(shortEntityNameWithArticle)} {boldVerb}{" "}
                    {formatTrade(total)}
                </>
            ) : (
                <>
                    and {boldVerb} {formatTrade(total)}
                </>
            )
        }
        return (
            <>
                {R.capitalize(shortEntityNameWithArticle)} {boldVerb}{" "}
                {formatTrade(total)}
            </>
        )
    }
    return view === "both" ? (
        <>
            {R.capitalize(shortEntityNameWithArticle)} {boldVerb} none
        </>
    ) : (
        `No ${noun}`
    )
}

function getTradeLinkTooltip({
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

    const title = isOther
        ? exporter === "Other"
            ? "Other exporters"
            : "Other importers"
        : `${exporter} → ${importer}`

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
    const { visible, hiddenCount } = capItems(breakdown)

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

function makeAnnotation(
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
