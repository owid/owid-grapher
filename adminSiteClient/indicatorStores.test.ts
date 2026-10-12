/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest"
import { ColumnTypeNames, DimensionProperty } from "@ourworldindata/types"
import { csvIndicatorStore } from "./indicatorStores.js"

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
        const catalog = await makeStore().catalog!.load()
        expect(catalog.namespaces.map((n) => n.name)).toEqual(["housing.csv"])
        expect(catalog.datasets[0].variables).toEqual([
            { id: 1, slug: "rent_index", name: "Rent index" },
            { id: 2, slug: "vacancy_rate", name: "vacancy_rate" },
            { id: 3, slug: "region", name: "region" },
        ])
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
