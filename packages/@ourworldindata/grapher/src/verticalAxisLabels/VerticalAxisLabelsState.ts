import * as R from "remeda"
import { computed } from "mobx"
import { Bounds } from "@ourworldindata/utils"

interface VerticalAxisLabelsOptions {
    fontSize: number
    resolveCollision?: (
        s1: InitialVerticalAxisLabelsSeries,
        s2: InitialVerticalAxisLabelsSeries
    ) => InitialVerticalAxisLabelsSeries
}

export interface InitialVerticalAxisLabelsSeries {
    seriesName: string
    value: number
    label: string
    position: number
    color: string
}

interface SizedVerticalAxisLabelsSeries
    extends InitialVerticalAxisLabelsSeries {
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

    @computed
    private get sizedSeries(): SizedVerticalAxisLabelsSeries[] {
        return this.initialSeries.map((series) => {
            const bounds = Bounds.forText(series.label, {
                fontSize: this.options.fontSize,
            }).set({ y: series.position })

            return { ...series, bounds }
        })
    }

    @computed get series(): VerticalAxisLabelsSeries[] {
        // None of the series are initially hidden
        const series = this.sizedSeries.map((series) => ({
            ...series,
            isHidden: false,
        }))

        for (let i = 0; i < series.length; i++) {
            const s1 = series[i]
            if (s1.isHidden) continue

            for (let j = i + 1; j < series.length; j++) {
                const s2 = series[j]
                if (s2.isHidden) continue

                if (s1.bounds.hasVerticalOverlap(s2.bounds)) {
                    const picked = this.options.resolveCollision?.(s1, s2) ?? s1

                    if (picked === s1) s2.isHidden = true
                    else s1.isHidden = true
                }
            }
        }

        return series
            .filter((series) => !series.isHidden)
            .map((series) => R.omit(series, ["isHidden"]))
    }

    @computed get width(): number {
        const labelWidths = this.series.map((series) => series.bounds.width)
        const maxLabelWidth = R.firstBy(labelWidths, [R.identity(), "desc"])
        return maxLabelWidth ?? 0
    }
}
