import * as R from "remeda"
import { Color } from "@ourworldindata/utils"
import { ColorScheme } from "./ColorScheme"
import { getLeastUsedColor } from "./ColorUtils"

type CategoryId = string
export type CategoricalColorMap = Map<CategoryId, Color>
export type CategoricalColorMapReadonly = ReadonlyMap<CategoryId, Color>

export interface CategoricalColorAssignerProps {
    colorScheme: ColorScheme
    invertColorScheme?: boolean

    /** The custom color mappings (most likely author-specified) to use. */
    colorMap?: CategoricalColorMap

    /**
     * A cache for custom colors or automatically selected colors for each identifier
     * encountered.
     *
     * In the Grapher, this is persisted across charts, so that a line chart
     * that turns into a bar chart will have a matching color scheme across
     * both states.
     */
    autoColorMapCache?: CategoricalColorMap

    numColorsInUse?: number
}

/**
 * Assigns custom categorical colors, e.g. specified by an author for entities or variables.
 *
 * When an identifier doesn't have an assigned color, it uses the least used color in the scheme.
 *
 * Keeps a cache so that identical identifiers are assigned consistent colors. See
 * Grapher#seriesColorMap for an example of a cache.
 */
export class CategoricalColorAssigner {
    private colorScheme: ColorScheme
    private invertColorScheme: boolean
    private colorMap: CategoricalColorMapReadonly
    private autoColorMapCache: CategoricalColorMap
    private numColorsInUse?: number

    constructor(props: CategoricalColorAssignerProps) {
        this.colorScheme = props.colorScheme
        this.invertColorScheme = props.invertColorScheme ?? false
        this.colorMap = props.colorMap ?? new Map()
        this.autoColorMapCache = props.autoColorMapCache ?? new Map()
        this.numColorsInUse = props.numColorsInUse
    }

    private get usedColors(): Color[] {
        const merged: CategoricalColorMap = new Map([
            ...this.autoColorMapCache,
            ...this.colorMap,
        ])
        return Array.from(merged.values())
    }

    private get availableColors(): Color[] {
        // copy the colors array because we might need to reverse it
        const colors =
            (this.numColorsInUse !== undefined
                ? this.colorScheme.getColors(this.numColorsInUse)
                : R.last(this.colorScheme.colorSets)
            )?.slice() ?? []
        if (this.invertColorScheme) return colors.toReversed()
        else return colors
    }

    private get leastUsedColor(): Color {
        const leastUsedColor = getLeastUsedColor(
            this.availableColors,
            this.usedColors
        )
        // TODO handle this better?
        if (leastUsedColor === undefined) {
            // eslint-disable-next-line no-console
            console.trace("Least used color is undefined, using black.", {
                availableColors: this.availableColors,
                usedColors: this.usedColors,
            })
        }
        return leastUsedColor ?? "#000"
    }

    assign(id: CategoryId): Color {
        let color = this.colorMap.get(id)
        if (color === undefined) color = this.autoColorMapCache.get(id)
        if (color === undefined) color = this.leastUsedColor
        this.autoColorMapCache.set(id, color)
        return color
    }
}
