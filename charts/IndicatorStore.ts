import { fetchJSON } from "./Util"
import { Indicator } from "./Indicator"
import { BAKED_BASE_URL } from "settings"
import { FuzzySearch } from "./FuzzySearch"

export class IndicatorStore {
    private indicatorsById: { [id: number]: Indicator } = {}
    private fetchPromise?: Promise<void>

    private async fetchAll() {
        try {
            const json = await fetchJSON(
                `${BAKED_BASE_URL}/explore/indicators.json`
            )
            const indicators: Indicator[] = json.indicators
            return indicators
        } catch (error) {
            console.error("Failed to fetch indicators", error)
            return []
        }
    }

    private loadAllIdempotent() {
        if (!this.fetchPromise) {
            this.fetchPromise = new Promise(async resolve => {
                this.populate(await this.fetchAll())
                resolve()
            })
        }
        return this.fetchPromise
    }

    private populate(indicators: Indicator[]) {
        for (const indicator of indicators) {
            this.indicatorsById[indicator.id] = indicator
        }
    }

    async get(id: number): Promise<Indicator | null> {
        await this.loadAllIdempotent()
        return id in this.indicatorsById ? this.indicatorsById[id] : null
    }

    async search(props: { query: string }): Promise<Indicator[]> {
        await this.loadAllIdempotent()
        const { query } = props
        const indicators = Object.values(this.indicatorsById)
        if (!query) {
            // If there is no search query, return full list
            return indicators
        } else {
            const fuzzy = new FuzzySearch(indicators, "title")
            return fuzzy.search(query)
        }
    }
}
