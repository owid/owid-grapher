import { SeriesName, InteractionState } from "@ourworldindata/types"
import { action, computed, observable } from "mobx"

export class FocusArray {
    constructor() {
        this.activeSet = new Set()
    }

    @observable private activeSet: Set<SeriesName>

    @computed get focusedSeriesNameSet(): Set<SeriesName> {
        return this.activeSet
    }

    @computed get focusedSeriesNames(): SeriesName[] {
        return Array.from(this.activeSet)
    }

    @computed get isEmpty(): boolean {
        return this.activeSet.size === 0
    }

    /**
     * Whether a series is currently highlighted
     */
    isFocused(seriesName: SeriesName): boolean {
        return this.activeSet.has(seriesName)
    }

    /**
     * Whether a series is in the foreground, i.e. either
     * the chart isn't currently is focus mode (in which
     * all series are in the foreground by default) or the
     * series itself is currently highlighted.
     */
    isInForeground(seriesName: SeriesName): boolean {
        return this.isEmpty || this.isFocused(seriesName)
    }

    /**
     * Whether a series is in the background, i.e. the chart
     * is currently in focus mode but the given series isn't
     * highlighted.
     */
    isInBackground(seriesName: SeriesName): boolean {
        return !this.isEmpty && !this.isFocused(seriesName)
    }

    /**
     * Get the interaction state of a series:
     * - active: whether the series is currently focused
     * - background: whether another series is currently focused
     */
    state(seriesName: SeriesName): InteractionState {
        return {
            active: this.isFocused(seriesName),
            background: this.isInBackground(seriesName),
        }
    }

    @action.bound activate(...seriesNames: SeriesName[]): this {
        for (const seriesName of seriesNames) {
            this.activeSet.add(seriesName)
        }
        return this
    }

    @action.bound deactivate(...seriesNames: SeriesName[]): this {
        for (const seriesName of seriesNames) {
            this.activeSet.delete(seriesName)
        }
        return this
    }

    @action.bound clearAllAndActivate(...seriesNames: SeriesName[]): this {
        this.clear()
        this.activate(...seriesNames)
        return this
    }

    @action.bound toggle(...seriesNames: SeriesName[]): this {
        for (const seriesName of seriesNames) {
            if (this.isFocused(seriesName)) {
                this.deactivate(seriesName)
            } else {
                this.activate(seriesName)
            }
        }
        return this
    }

    @action.bound clear(): void {
        this.activeSet.clear()
    }
}
