import * as R from "remeda"
import { computed } from "mobx"
import { Bounds, VerticalAlign } from "@ourworldindata/utils"
import { TextWrap } from "@ourworldindata/components"

interface VerticalAxisLabelsOptions {
    fontSize: number
    maxWidth?: number // no restriction by default
    minSpacing?: number // space between labels
    verticalAlign?: VerticalAlign
    resolveCollision?: (
        s1: InitialVerticalAxisLabelsSeries,
        s2: InitialVerticalAxisLabelsSeries
    ) => InitialVerticalAxisLabelsSeries
}

export interface InitialVerticalAxisLabelsSeries {
    seriesName: string
    value: number
    label: string
    yPosition: number
    color: string
}

interface SizedVerticalAxisLabelsSeries
    extends InitialVerticalAxisLabelsSeries {
    textWrap: TextWrap
    bounds: Bounds
}

type VerticalAxisLabelsSeries = SizedVerticalAxisLabelsSeries

export class VerticalAxisLabelsState {
    private initialSeries: InitialVerticalAxisLabelsSeries[]
    options: VerticalAxisLabelsOptions

    constructor(
        series: InitialVerticalAxisLabelsSeries[],
        options: VerticalAxisLabelsOptions
    ) {
        this.initialSeries = series
        this.options = options
    }

    @computed private get maxWidth(): number {
        return this.options.maxWidth ?? Infinity
    }

    @computed private get minSpacing(): number {
        return this.options.minSpacing ?? 5
    }

    @computed private get verticalAlign(): VerticalAlign {
        return this.options.verticalAlign ?? VerticalAlign.middle
    }

    @computed
    private get sizedSeries(): SizedVerticalAxisLabelsSeries[] {
        const {
            maxWidth,
            verticalAlign,
            options: { fontSize },
        } = this

        return this.initialSeries.map((series) => {
            const { label, yPosition } = series

            const textWrap = new TextWrap({
                text: label,
                maxWidth,
                fontSize,
                verticalAlign,
            })

            const [x, y] = textWrap.getPositionForSvgRendering(0, yPosition)
            const bounds = new Bounds(x, y, textWrap.width, textWrap.height)

            return { ...series, textWrap, bounds }
        })
    }

    @computed get series(): VerticalAxisLabelsSeries[] {
        const margin = this.minSpacing > 0 ? this.minSpacing / 2 : 0
        const margins = { top: margin, bottom: margin }

        const series = this.sizedSeries.map((series) => ({
            ...series,
            // Bounds used to detect collisions. They're a bit larger than the
            // text bounds to account for the minimum spacing between labels.
            collisionBounds: series.bounds.expand(margins),
            // None of the series are initially hidden
            isHidden: false,
        }))

        for (let i = 0; i < series.length; i++) {
            const s1 = series[i]
            if (s1.isHidden) continue

            for (let j = i + 1; j < series.length; j++) {
                const s2 = series[j]
                if (s2.isHidden) continue

                if (s1.collisionBounds.hasVerticalOverlap(s2.collisionBounds)) {
                    const picked = this.options.resolveCollision?.(s1, s2) ?? s1

                    if (picked === s1) s2.isHidden = true
                    else s1.isHidden = true
                }
            }
        }

        return series
            .filter((series) => !series.isHidden)
            .map((series) => R.omit(series, ["isHidden", "collisionBounds"]))
    }

    @computed get width(): number {
        const labelWidths = this.series.map((series) => series.textWrap.width)
        const maxLabelWidth = R.firstBy(labelWidths, [R.identity(), "desc"])
        return maxLabelWidth ?? 0
    }
}
