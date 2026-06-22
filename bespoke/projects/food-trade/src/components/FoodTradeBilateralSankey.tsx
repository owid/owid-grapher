import { useCallback, useMemo } from "react"
import { useParentSize } from "@visx/responsive"

import { TooltipTable } from "@ourworldindata/grapher/src/tooltip/TooltipContents.js"

import {
    getEntityShortLabel,
    Flow,
} from "../../../../components/Sankey/SankeyHelpers.js"
import {
    LinkSide,
    SankeyTooltip,
} from "../../../../components/Sankey/Sankey.js"
import {
    BilateralFlowSankey,
    BilateralTooltipArgs,
} from "../../../../components/Sankey/BilateralFlowSankey.js"
import { MOBILE_BREAKPOINT } from "../../../../components/Sankey/SplitFlowSankey.js"

import { type TradeRow } from "../types.js"
import { capItems, formatTrade, tradesToFlows } from "../helpers.js"

export function FoodTradeBilateralSankey({
    trades,
    year,
    onSelectEntity,
}: {
    trades: TradeRow[]
    year: number
    onSelectEntity?: (entity: string, side: "exporter" | "importer") => void
}) {
    const { parentRef, width, height } = useParentSize()

    const flows = useMemo(() => tradesToFlows(trades), [trades])

    const isNarrow = width > 0 && width < MOBILE_BREAKPOINT
    const formatValue = useCallback(
        (v: number) => formatTrade(v, { short: isNarrow }),
        [isNarrow]
    )

    const getTooltip = useCallback(
        (args: BilateralTooltipArgs) => getBilateralTooltip({ ...args, year }),
        [year]
    )

    const handleSelectEntity = onSelectEntity
        ? (entity: string, side: LinkSide) =>
              onSelectEntity(
                  entity,
                  side === "source" ? "exporter" : "importer"
              )
        : undefined

    return (
        <div ref={parentRef} className="food-trade-sankey">
            <BilateralFlowSankey
                flows={flows}
                width={width}
                height={height}
                linkLowVolumeThreshold={0.01} // decrease opacity for flows below 1% of the total
                formatValue={formatValue}
                getTooltip={getTooltip}
                onSelectEntity={handleSelectEntity}
            />
        </div>
    )
}

function getBilateralTooltip({
    side,
    entity,
    partners,
    flows,
    year,
}: BilateralTooltipArgs & { year: number }): SankeyTooltip {
    const isOther = entity === "Other"
    const isExporterSide = side === "source"

    const title = isOther
        ? isExporterSide
            ? "Other exporters"
            : "Other importers"
        : entity

    const subtitle = isOther
        ? year.toString()
        : isExporterSide
          ? `Exports in ${year}`
          : `Imports in ${year}`

    const allRows = isOther
        ? aggregateOtherBucket(flows, side)
        : partners.map((p) => ({
              name: getEntityShortLabel(p.entity),
              value: p.total,
          }))

    const cappedRows = capItems(allRows)

    const columns = [
        {
            label: "tonnes",
            formatValue: (v: unknown) =>
                typeof v === "number" ? formatTrade(v) : "",
        },
    ]

    const tableRows = cappedRows.visible.map((d) => ({
        name: d.name,
        values: [d.value],
    }))

    return {
        title,
        subtitle,
        content: (
            <>
                <TooltipTable columns={columns} rows={tableRows} />
                {cappedRows.hiddenCount > 0 && (
                    <div className="food-trade-sankey__tooltip-more">
                        + {cappedRows.hiddenCount} more countries
                    </div>
                )}
            </>
        ),
    }
}

// Group the rows of an Other-bucket hover by the entity that was folded
// into the bucket (source for the left Other, target for the right Other),
// sum each entity's total, and sort descending.
function aggregateOtherBucket(
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
