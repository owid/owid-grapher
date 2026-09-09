import { Bounds } from "@ourworldindata/utils"
import { GrapherTooltipAnchor } from "@ourworldindata/types"
import { TooltipCard } from "@ourworldindata/grapher/src/tooltip/TooltipCard.js"
import { TooltipTable } from "@ourworldindata/grapher/src/tooltip/TooltipContents.js"

import {
    formatAgeBand,
    formatTooltipCount,
    formatTooltipShare,
    PyramidRow,
} from "../core/helpers.js"
import { ShowMode } from "../core/types.js"
import { MEN_COLOR, WOMEN_COLOR } from "../core/constants.js"

export function MigrantPyramidTooltip({
    migrants,
    natives,
    mode,
    position,
    containerBounds,
    isPinned,
}: {
    /** Read straight from the rows the bars encode, so the two can't disagree */
    migrants: PyramidRow
    /** Only set while the comparison is switched on */
    natives?: PyramidRow
    mode: ShowMode
    position: { x: number; y: number }
    containerBounds: Bounds
    /** Pinned to the bottom of the viewport on touch devices */
    isPinned: boolean
}): React.ReactElement {
    // `TooltipTable` hands cells over untyped; every row here supplies a number
    const formatCell = (value: unknown): string => {
        if (typeof value !== "number") return ""
        return mode === "share"
            ? formatTooltipShare(value)
            : formatTooltipCount(value)
    }

    // One column per population; the header row only appears when comparing
    const populations = [
        { label: "Immigrants", row: migrants },
        ...(natives ? [{ label: "Native-born", row: natives }] : []),
    ]

    return (
        <TooltipCard
            id="migrant-pyramid-tooltip"
            x={position.x}
            y={position.y}
            offsetX={12}
            offsetY={12}
            title={formatAgeBand(migrants.band)}
            containerBounds={isPinned ? undefined : containerBounds}
            anchor={isPinned ? GrapherTooltipAnchor.Bottom : undefined}
        >
            <TooltipTable
                columns={populations.map(({ label }) => ({
                    label,
                    formatValue: formatCell,
                }))}
                rows={[
                    {
                        name: "Men",
                        swatch: { color: MEN_COLOR },
                        values: populations.map(({ row }) => row.men),
                    },
                    {
                        name: "Women",
                        swatch: { color: WOMEN_COLOR },
                        values: populations.map(({ row }) => row.women),
                    },
                ]}
                totals={populations.map(({ row }) => row.men + row.women)}
            />
        </TooltipCard>
    )
}
