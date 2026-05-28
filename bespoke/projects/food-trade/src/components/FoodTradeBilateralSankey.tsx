import { useCallback, useMemo } from "react"
import { useParentSize } from "@visx/responsive"

import { TooltipTable } from "@ourworldindata/grapher/src/tooltip/TooltipContents.js"

import { getEntityShortLabel, Flow } from "../../../../components/Sankey/helpers.js"
import { LinkSide, SankeyTooltip } from "../../../../components/Sankey/Sankey.js"
import {
    BilateralFlowSankey,
    BilateralTooltipArgs,
} from "../../../../components/Sankey/BilateralFlowSankey.js"
import { MOBILE_BREAKPOINT } from "../../../../components/Sankey/SplitFlowSankey.js"

import { type TradeRow } from "../data.js"
import { formatTrade, tradeToFlow } from "../helpers.js"

// Bilateral importer table uses a tighter cap — the table is per exporter,
// and the chart already names the most-significant ones. show-all is set to
// top_n + 2 so we never end up with a "+1 / +2 more" line (just show all).
const BILATERAL_TOP_N = 8
const BILATERAL_SHOW_ALL_BELOW = 10

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

    const isNarrow = width > 0 && width < MOBILE_BREAKPOINT
    const formatValue = useCallback(
        (v: number) => formatTrade(v, { short: isNarrow }),
        [isNarrow]
    )

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
                rows={flowRows}
                width={width}
                height={height}
                formatValue={formatValue}
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
