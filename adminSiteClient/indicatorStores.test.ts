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
            { id: 1, name: "Rent index" },
            { id: 2, name: "vacancy_rate" },
            { id: 3, name: "region" },
        ])
    })

    it("keeps a categorical colour column through the round trip", () => {
        const store = makeStore()
        const editorConfig = store.toEditorConfig({
            ySlugs: "rent_index",
            colorSlug: "region",
        })
        expect(editorConfig.dimensions).toEqual([
            { property: DimensionProperty.y, variableId: 1 },
            { property: DimensionProperty.color, variableId: 3 },
        ])
        expect(store.fromEditorConfig(editorConfig)).toEqual({
            ySlugs: "rent_index",
            colorSlug: "region",
        })
    })

    it("remaps the Table tab's tableSlugs to keys and back", () => {
        const store = makeStore()
        const editorConfig = store.toEditorConfig({
            ySlugs: "rent_index",
            tableSlugs: "rent_index vacancy_rate",
        })
        expect(editorConfig.tableSlugs).toBe("1 2")
        expect(store.fromEditorConfig(editorConfig).tableSlugs).toBe(
            "rent_index vacancy_rate"
        )
    })

    it("turns slug references into dimensions the editor understands", () => {
        const editorConfig = makeStore().toEditorConfig({
            title: "Rents",
            ySlugs: "rent_index vacancy_rate",
            colorSlug: "vacancy_rate",
        })
        expect(editorConfig.ySlugs).toBeUndefined()
        expect(editorConfig.colorSlug).toBeUndefined()
        expect(editorConfig.dimensions).toEqual([
            { property: DimensionProperty.y, variableId: 1 },
            { property: DimensionProperty.y, variableId: 2 },
            { property: DimensionProperty.color, variableId: 2 },
        ])
    })

    it("plots every numeric column when the config names none", () => {
        const editorConfig = makeStore().toEditorConfig({ title: "Rents" })
        expect(editorConfig.dimensions?.map((d) => d.variableId)).toEqual([
            1, 2,
        ])
    })

    it("leaves a base config without dimensions when asked not to infer them", () => {
        const editorConfig = makeStore().toEditorConfig(
            { note: "House style" },
            { inferDimensions: false }
        )
        expect(editorConfig).toEqual({ note: "House style" })
    })

    it("writes slugs back and drops the dimensions on the way out", () => {
        const hostConfig = makeStore().fromEditorConfig({
            title: "Rents",
            dimensions: [
                { property: DimensionProperty.y, variableId: 2 },
                { property: DimensionProperty.x, variableId: 1 },
            ],
        })
        expect(hostConfig).toEqual({
            title: "Rents",
            ySlugs: "vacancy_rate",
            xSlug: "rent_index",
        })
    })

    it("serves the table with columns renamed to the editor's keys", async () => {
        const table = await makeStore().loadTable(
            [{ property: DimensionProperty.y, variableId: 1 }],
            undefined
        )
        expect(table!.numericColumnSlugs).toEqual(["1", "2"])
        expect(table!.get("3").values).toEqual(["DE", "DE", "AT", "AT"])
        expect(table!.get("1").displayName).toBe("Rent index")
        expect(table!.get("1").unit).toBe("index (2015 = 100)")
        // a column without a name keeps its slug as the display name
        expect(table!.get("2").displayName).toBe("vacancy_rate")
        expect(table!.get("1").values).toEqual([100, 131, 100, 112])
    })

    it("round-trips a slug config through the editor form", () => {
        const store = makeStore()
        const config = {
            title: "Rents",
            ySlugs: "rent_index",
            xSlug: "vacancy_rate",
        }
        expect(store.fromEditorConfig(store.toEditorConfig(config))).toEqual(
            config
        )
    })
})
