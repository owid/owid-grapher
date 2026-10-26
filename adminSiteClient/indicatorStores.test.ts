/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from "vitest"
import {
    ColumnTypeNames,
    DimensionProperty,
    OwidTableSlugs,
} from "@ourworldindata/types"
import { csvIndicatorStore, dataApiIndicatorStore } from "./indicatorStores.js"

const csv = `entityName,year,rent_index,vacancy_rate,region
Berlin,2015,100,3.1,DE
Berlin,2020,131,1.2,DE
Vienna,2015,100,4.0,AT
Vienna,2020,112,3.8,AT`

function makeStore() {
    return csvIndicatorStore({
        csv,
        name: "housing.csv",
        columnDefs: [
            {
                slug: "rent_index",
                type: ColumnTypeNames.Numeric,
                name: "Rent index",
                unit: "index (2015 = 100)",
            },
            { slug: "vacancy_rate", type: ColumnTypeNames.Numeric },
        ],
    })
}

describe(csvIndicatorStore, () => {
    it("offers every data column as a pickable indicator, categorical ones included", async () => {
        const page = await makeStore().catalog!.search("", 1)
        expect(page.datasets.map((dataset) => dataset.name)).toEqual([
            "housing.csv",
        ])
        expect(page.datasets[0].variables).toEqual([
            { id: 1, name: "Rent index", column: { slug: "rent_index" } },
            { id: 2, name: "vacancy_rate", column: { slug: "vacancy_rate" } },
            { id: 3, name: "region", column: { slug: "region" } },
        ])
    })

    it("searches the columns by name and by slug", async () => {
        const catalog = makeStore().catalog!
        const names = async (query: string): Promise<string[]> =>
            (await catalog.search(query, 1)).datasets.flatMap((dataset) =>
                dataset.variables.map((variable) => variable.name)
            )
        expect(await names("rent")).toEqual(["Rent index"])
        expect(await names("vacancy_r")).toEqual(["vacancy_rate"])
        expect(await names("-rent")).toEqual(["vacancy_rate", "region"])
        expect(await names("nothing")).toEqual([])
    })

    it("serves the columns the dimensions name, under the host's own slugs", async () => {
        const table = await makeStore().loadTable(
            [
                { property: DimensionProperty.y, slug: "rent_index" },
                { property: DimensionProperty.color, slug: "region" },
            ],
            undefined
        )
        expect(table!.numericColumnSlugs).toEqual(["rent_index"])
        expect(table!.has("vacancy_rate")).toBe(false)
        expect(table!.get("region").values).toEqual(["DE", "DE", "AT", "AT"])
        expect(table!.get("region").displayName).toBe("region")
        expect(table!.get("rent_index").displayName).toBe("Rent index")
        expect(table!.get("rent_index").unit).toBe("index (2015 = 100)")
        expect(table!.get("rent_index").values).toEqual([100, 131, 100, 112])
    })

    it("colors the entities the config picks a color for", async () => {
        const table = await makeStore().loadTable(
            [{ property: DimensionProperty.y, slug: "rent_index" }],
            { Berlin: "#ff0000" }
        )
        expect(table!.get(OwidTableSlugs.EntityColor).values).toEqual([
            "#ff0000",
            "#ff0000",
        ])
    })

    it("applies a dimension's display on every load, from the raw values", async () => {
        const store = makeStore()
        const dimensions = [
            {
                property: DimensionProperty.y,
                slug: "rent_index",
                display: { name: "Rent", conversionFactor: 10 },
            },
        ]
        await store.loadTable(dimensions, undefined)
        const table = await store.loadTable(dimensions, undefined)
        expect(table!.get("rent_index").displayName).toBe("Rent")
        expect(table!.get("rent_index").values).toEqual([
            1000, 1310, 1000, 1120,
        ])
    })

    it("serves no data columns, only the entities, when a chart names none", async () => {
        const table = await makeStore().loadTable([], undefined)
        expect(table!.numericColumnSlugs).toEqual([])
        expect(table!.has("region")).toBe(false)
        expect(table!.availableEntityNames).toEqual(["Berlin", "Vienna"])
    })
})

describe("dataApiIndicatorStore with datasets", () => {
    const datasets = () =>
        Promise.resolve(
            Array.from({ length: 10 }, (_, i) => ({
                id: i + 1,
                name: `Dataset ${i + 1}`,
                namespace: "who",
                variables: [
                    { id: 100 + i, name: `Deaths ${i + 1}` },
                    { id: 200 + i, name: `Births ${i + 1}` },
                ],
            }))
        )
    const catalogOf = (load: typeof datasets) =>
        dataApiIndicatorStore({ dataApiUrl: "", datasets: load }).catalog!

    it("offers the datasets' indicators, picked by id", async () => {
        const page = await catalogOf(datasets).search("births 3", 1)
        expect(page).toMatchObject({ unit: "datasets", total: 1 })
        expect(page.datasets[0]).toMatchObject({
            id: 3,
            namespace: "who",
            matchCount: 1,
            variables: [{ id: 202, column: { variableId: 202 } }],
        })
    })

    it("pages through the datasets with a match", async () => {
        const catalog = catalogOf(datasets)
        const first = await catalog.search("deaths", 1)
        const second = await catalog.search("deaths", 2)
        expect(first.total).toBe(10)
        expect([...first.datasets, ...second.datasets]).toHaveLength(10)
        expect(second.datasets[0].id).toBe(first.pageSize + 1)
    })

    it("loads the datasets once, and again after a failed load", async () => {
        const load = vi.fn(datasets).mockRejectedValueOnce(new Error("offline"))
        const catalog = catalogOf(load)
        expect(load).not.toHaveBeenCalled()
        await expect(catalog.search("", 1)).rejects.toThrow("offline")
        await catalog.search("", 1)
        await catalog.search("deaths", 1)
        expect(load).toHaveBeenCalledTimes(2)
    })
})
