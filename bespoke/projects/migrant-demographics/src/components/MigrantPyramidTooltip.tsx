import { Bounds } from "@ourworldindata/utils"
import { GrapherTooltipAnchor } from "@ourworldindata/types"
import { TooltipCard } from "@ourworldindata/grapher/src/tooltip/TooltipCard.js"
import { TooltipTable } from "@ourworldindata/grapher/src/tooltip/TooltipContents.js"

import {
    formatAgeBand,
    formatTooltipCount,
    formatTooltipShare,
    PyramidView,
} from "../helpers.js"
import { SexValues, ShowMode } from "../types.js"
import { MEN_COLOR, WOMEN_COLOR } from "../constants.js"

export function MigrantPyramidTooltip({
    band,
    bandIndex,
    view,
    mode,
    position,
    containerBounds,
    isPinned,
}: {
    band: string
    /** Index into the age-band-aligned value arrays */
    bandIndex: number
    /** Read straight from the values the bars encode, so the two can't disagree */
    view: PyramidView
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
    const populations = view.natives
        ? [
              { label: "Immigrants", values: view.migrants },
              { label: "Native-born", values: view.natives },
          ]
        : [{ label: "Immigrants", values: view.migrants }]

    return (
        <TooltipCard
            id="migrant-pyramid-tooltip"
            x={position.x}
            y={position.y}
            offsetX={12}
            offsetY={12}
            title={formatAgeBand(band)}
            containerBounds={isPinned ? undefined : containerBounds}
            anchor={isPinned ? GrapherTooltipAnchor.Bottom : undefined}
        >
            <TooltipTable
                columns={populations.map(({ label }) => ({
                    label,
                    formatValue: formatCell,
                }))}
                rows={ROW_SPECS.map(({ name, color, valueAt }) => ({
                    name,
                    swatch: color ? { color } : undefined,
                    values: populations.map(({ values }) =>
                        valueAt(values, bandIndex)
                    ),
                }))}
            />
        </TooltipCard>
    )
}

/** The rows every column is broken down into. `Total` gets no swatch so it
 *  reads as a summary rather than a series. */
const ROW_SPECS: {
    name: string
    color?: string
    valueAt: (values: SexValues, bandIndex: number) => number
}[] = [
    {
        name: "Men",
        color: MEN_COLOR,
        valueAt: (values, i) => values.men[i] ?? 0,
    },
    {
        name: "Women",
        color: WOMEN_COLOR,
        valueAt: (values, i) => values.women[i] ?? 0,
    },
    {
        name: "Total",
        valueAt: (values, i) => (values.men[i] ?? 0) + (values.women[i] ?? 0),
    },
]
