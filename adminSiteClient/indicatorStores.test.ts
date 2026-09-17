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
        // a dimension names the column by slug; the id only keys the picker
        expect(catalog.datasets[0].variables).toEqual([
            { id: 1, slug: "rent_index", name: "Rent index" },
            { id: 2, slug: "vacancy_rate", name: "vacancy_rate" },
            { id: 3, slug: "region", name: "region" },
        ])
    })

    it("serves the table under the host's own column slugs", async () => {
        const table = await makeStore().loadTable(
            [{ property: DimensionProperty.y, slug: "rent_index" }],
            undefined
        )
        expect(table!.numericColumnSlugs).toEqual([
            "rent_index",
            "vacancy_rate",
        ])
        expect(table!.get("region").values).toEqual(["DE", "DE", "AT", "AT"])
        expect(table!.get("rent_index").displayName).toBe("Rent index")
        expect(table!.get("rent_index").unit).toBe("index (2015 = 100)")
        // a column without a name keeps its slug as the display name
        expect(table!.get("vacancy_rate").displayName).toBe("vacancy_rate")
        expect(table!.get("rent_index").values).toEqual([100, 131, 100, 112])
    })

    it("keeps the table it has when a chart names no columns", async () => {
        const table = await makeStore().loadTable([], undefined)
        expect(table).toBeUndefined()
    })
})
