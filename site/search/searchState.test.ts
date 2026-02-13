import { describe, expect, it } from "vitest"
import { searchParamsToState, stateToSearchParams } from "./searchState.js"
import {
    createDatasetProductsFilter,
    createDatasetNamespaceFilter,
    createDatasetVersionFilter,
    createDatasetProducerFilter,
    getFilterNamesOfType,
} from "./searchUtils.js"
import {
    FilterType,
    SearchResultType,
    SearchState,
} from "@ourworldindata/types"

const emptyRegions: string[] = []
const emptyTopics: string[] = []

describe("searchState URL parsing", () => {
    it("round-trips dataset filters via URL params", () => {
        const state: SearchState = {
            query: "mortality",
            requireAllCountries: false,
            resultType: SearchResultType.DATA,
            filters: [
                createDatasetProductsFilter("gbd"),
                createDatasetNamespaceFilter("who"),
                createDatasetVersionFilter("2024-05-15"),
                createDatasetProducerFilter("World Bank"),
            ],
        }

        const params = stateToSearchParams(state)
        const parsed = searchParamsToState(params, emptyRegions, emptyTopics)

        expect(
            getFilterNamesOfType(parsed.filters, FilterType.DATASET_PRODUCT)
        ).toEqual(new Set(["gbd"]))
        expect(
            getFilterNamesOfType(parsed.filters, FilterType.DATASET_NAMESPACE)
        ).toEqual(new Set(["who"]))
        expect(
            getFilterNamesOfType(parsed.filters, FilterType.DATASET_VERSION)
        ).toEqual(new Set(["2024-05-15"]))
        expect(
            getFilterNamesOfType(parsed.filters, FilterType.DATASET_PRODUCER)
        ).toEqual(new Set(["World Bank"]))
    })

    it("drops empty dataset-related values from URL params", () => {
        const params = new URLSearchParams({
            datasetProducts: "gbd~~pwt~",
            datasetNamespaces: "~who",
            datasetVersions: "~~2024-05-15~",
            datasetProducers: "~World Bank~~UNICEF~",
        })

        const parsed = searchParamsToState(params, emptyRegions, emptyTopics)

        expect(
            getFilterNamesOfType(parsed.filters, FilterType.DATASET_PRODUCT)
        ).toEqual(new Set(["gbd", "pwt"]))
        expect(
            getFilterNamesOfType(parsed.filters, FilterType.DATASET_NAMESPACE)
        ).toEqual(new Set(["who"]))
        expect(
            getFilterNamesOfType(parsed.filters, FilterType.DATASET_VERSION)
        ).toEqual(new Set(["2024-05-15"]))
        expect(
            getFilterNamesOfType(parsed.filters, FilterType.DATASET_PRODUCER)
        ).toEqual(new Set(["World Bank", "UNICEF"]))
    })
})
