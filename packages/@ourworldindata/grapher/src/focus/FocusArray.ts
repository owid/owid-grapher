import { SeriesName, InteractionState } from "@ourworldindata/types"
import { action, computed, observable } from "mobx"

export class FocusArray {
    constructor() {
        this.store = new Set()
    }

    @observable private store: Set<SeriesName>

    @computed get seriesNameSet(): Set<SeriesName> {
        return this.store
    }

    @computed get seriesNames(): SeriesName[] {
        return Array.from(this.store)
    }

    @computed get isEmpty(): boolean {
        return this.store.size === 0
    }

    /**
     * Whether a series is currently focused
     */
    has(seriesName: SeriesName): boolean {
        return this.store.has(seriesName)
    }

    /**
     * Whether a series is in the foreground, i.e. either
     * the chart isn't currently in focus mode (in which
     * all series are in the foreground by default) or the
     * series itself is currently focused.
     */
    isInForeground(seriesName: SeriesName): boolean {
        return this.isEmpty || this.has(seriesName)
    }

    /**
     * Whether a series is in the background, i.e. the chart
     * is currently in focus mode but the given series isn't
     * focused.
     */
    isInBackground(seriesName: SeriesName): boolean {
        return !this.isEmpty && !this.has(seriesName)
    }

    /**
     * Get the interaction state of a series:
     * - active: true if the series is currently focused
     * - background: true if another series is currently focused
     */
    state(seriesName: SeriesName): InteractionState {
        return {
            active: this.has(seriesName),
            background: this.isInBackground(seriesName),
        }
    }

    @action.bound add(...seriesNames: SeriesName[]): this {
        for (const seriesName of seriesNames) {
            this.store.add(seriesName)
        }
        return this
    }

    @action.bound remove(...seriesNames: SeriesName[]): this {
        for (const seriesName of seriesNames) {
            this.store.delete(seriesName)
        }
        return this
    }

    @action.bound clearAllAndAdd(...seriesNames: SeriesName[]): this {
        this.clear()
        this.add(...seriesNames)
        return this
    }

    @action.bound toggle(...seriesNames: SeriesName[]): this {
        for (const seriesName of seriesNames) {
            if (this.has(seriesName)) {
                this.remove(seriesName)
            } else {
                this.add(seriesName)
            }
        }
        return this
    }

    @action.bound clear(): void {
        this.store.clear()
    }
}
