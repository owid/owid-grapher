import { SeriesName, InteractionState } from "@ourworldindata/types"
import { action, computed, observable } from "mobx"

/**
 * A class to manage a set of active series that are activated
 * deactivated by being interacted with, e.g. by hovering or focusing.
 */
export class InteractionArray {
    constructor() {
        this.activeSeriesNames = []
    }

    @observable activeSeriesNames: SeriesName[]

    @computed get activeSeriesNameSet(): Set<SeriesName> {
        return new Set(this.activeSeriesNames)
    }

    @computed get isEmpty(): boolean {
        return this.activeSeriesNames.length === 0
    }

    @computed get hasActiveSeries(): boolean {
        return !this.isEmpty
    }

    @computed get first(): SeriesName | undefined {
        if (this.hasActiveSeries) return this.activeSeriesNames[0]
        return undefined
    }

    /**
     * Whether a series is currently interacted with
     */
    isActive(seriesName: SeriesName): boolean {
        return this.activeSeriesNameSet.has(seriesName)
    }

    /**
     * Whether a series is in the foreground, i.e. either
     * the chart isn't currently interacted with (in which
     * all series are in the foreground by default) or the
     * series is currently active.
     */
    isInForeground(seriesName: SeriesName): boolean {
        return this.isEmpty || this.isActive(seriesName)
    }

    /**
     * Whether a series is in the background, i.e. the chart
     * is currently interacted with but the series isn't.
     */
    isInBackground(seriesName: SeriesName): boolean {
        return this.hasActiveSeries && !this.isActive(seriesName)
    }

    /**
     * Get the interaction state of a series. Either 'active' or
     * 'background' (see definitions above). Returns undefined if
     * the chart isn't currently interacted with.
     */
    state(seriesName: SeriesName): InteractionState | undefined {
        if (this.isEmpty) return undefined
        return this.isInForeground(seriesName)
            ? InteractionState.active
            : InteractionState.background
    }

    @action.bound private _activate(seriesName: SeriesName): this {
        if (!this.activeSeriesNameSet.has(seriesName))
            this.activeSeriesNames.push(seriesName)
        return this
    }

    @action.bound activate(...seriesNames: SeriesName[]): this {
        for (const seriesName of seriesNames) {
            this._activate(seriesName)
        }
        return this
    }

    @action.bound deactivate(...seriesNames: SeriesName[]): this {
        const seriesNameSet = new Set(seriesNames)
        this.activeSeriesNames = this.activeSeriesNames.filter(
            (name) => !seriesNameSet.has(name)
        )
        return this
    }

    @action.bound clearAllAndActivate(...seriesNames: SeriesName[]): this {
        this.clear()
        this.activate(...seriesNames)
        return this
    }

    @action.bound clear(): void {
        this.activeSeriesNames = []
    }
}
