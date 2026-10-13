import { describe, expect, it, vi } from "vitest"
import { Admin } from "./Admin.js"
import { adminIndicatorCatalog } from "./editorProviders.js"
import {
    VariableResultView,
    VariablesGroupedSearchResult,
    VariablesSearchResult,
} from "../adminShared/variableSearch.js"

function indicator(
    id: number,
    datasetId: number,
    catalogPath: string
): VariableResultView {
    return {
        id,
        name: `Indicator ${id}`,
        catalogPath,
        datasetId,
        datasetName: `Dataset ${datasetId}`,
        isPrivate: false,
        nonRedistributable: false,
        uploadedAt: "2026-01-01T00:00:00.000Z",
        uploadedBy: null,
        popularity: null,
        charts: [],
        multiDims: [],
        explorerSlugs: [],
        usageCount: 0,
    }
}

function adminAnswering(
    response: VariablesSearchResult | VariablesGroupedSearchResult
): { admin: Admin; getJSON: ReturnType<typeof vi.fn> } {
    const getJSON = vi.fn(() => Promise.resolve(response))
    return {
        admin: { getJSONInBackground: getJSON } as unknown as Admin,
        getJSON,
    }
}

describe(adminIndicatorCatalog, () => {
    it("opens on the slot's dataset, but makes no guess for a slot spanning several", () => {
        const catalog = adminIndicatorCatalog({} as Admin)
        expect(catalog.initialQuery([42, 42])).toBe("dataset-id:42")
        expect(catalog.initialQuery([42, 43])).toBe("")
        expect(catalog.initialQuery([])).toBe("")
    })

    it("pages through datasets for a search that doesn't name one", async () => {
        const datasets: VariablesGroupedSearchResult = {
            datasets: [],
            numTotalDatasets: 17,
            numTotalRows: 120,
            unindexedTerms: [],
        }
        const { admin, getJSON } = adminAnswering(datasets)

        const page = await adminIndicatorCatalog(admin).search("deaths", 3)

        expect(getJSON).toHaveBeenCalledWith("/api/variables.json", {
            search: "deaths",
            group: "dataset",
            limit: 8,
            offset: 16,
        })
        expect(page).toMatchObject({ unit: "datasets", total: 17, pageSize: 8 })
    })

    it("pages through the indicators of a named dataset, under their dataset", async () => {
        const rows: VariablesSearchResult = {
            variables: [
                indicator(1, 7, "grapher/who/2026-05-22/gho/gho#a"),
                indicator(2, 7, "grapher/who/2026-05-22/gho/gho#b"),
                indicator(3, 8, "grapher/who/2025-01-01/gho/gho#a"),
            ],
            numTotalRows: 45,
            unindexedTerms: [],
            regexError: "missing )",
        }
        const { admin, getJSON } = adminAnswering(rows)

        const page = await adminIndicatorCatalog(admin).search("dataset:gho", 2)

        expect(getJSON).toHaveBeenCalledWith("/api/variables.json", {
            search: "dataset:gho",
            limit: 20,
            offset: 20,
        })
        expect(page).toMatchObject({
            unit: "indicators",
            total: 45,
            pageSize: 20,
            error: "missing )",
        })
        expect(
            page.datasets.map(
                ({ id, namespace, version, shortName, variables }) => ({
                    id,
                    path: `${namespace}/${version}/${shortName}`,
                    ids: variables.map((variable) => variable.id),
                })
            )
        ).toEqual([
            { id: 7, path: "who/2026-05-22/gho", ids: [1, 2] },
            { id: 8, path: "who/2025-01-01/gho", ids: [3] },
        ])
        // A page of one dataset doesn't know how many of it matched
        expect(page.datasets[0].matchCount).toBeUndefined()
    })
})
