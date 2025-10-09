import { action, computed, observable, makeObservable } from "mobx"
import { SeriesName } from "@ourworldindata/types"
import { InteractionState } from "../interaction/InteractionState.js"

export class FocusArray {
    constructor() {
        makeObservable<FocusArray, "store">(this, {
            store: observable,
        })
        this.store = new Set()
    }

    private store: Set<SeriesName>

    @computed get seriesNameSet(): Set<SeriesName> {
        return this.store
    }

    @computed get seriesNames(): SeriesName[] {
        return Array.from(this.store)
    }

    @computed get isEmpty(): boolean {
        return this.store.size === 0
    }

    @computed get hasFocusedSeries(): boolean {
        return !this.isEmpty
    }

    /**
     * Whether a series is currently focused
     */
    has(seriesName: SeriesName): boolean {
        return this.store.has(seriesName)
    }

    /**
     * Get the interaction state of a series
     */
    state(seriesName: SeriesName): InteractionState {
        return new InteractionState(this.has(seriesName), !this.isEmpty)
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
