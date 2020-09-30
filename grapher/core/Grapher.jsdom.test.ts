#! /usr/bin/env yarn jest

import { Grapher } from "grapher/core/Grapher"
import {
    ChartTypeName,
    DimensionProperty,
    GrapherTabOption,
} from "./GrapherConstants"

it("regression fix: container options are not serialized", () => {
    const grapher = new Grapher({ xAxis: { min: 1 } })
    const obj = grapher.toObject().xAxis!
    expect(obj.max).toBe(undefined)
    expect((obj as any).containerOptions).toBe(undefined) // Regression test: should never be a containerOptions
})

it("can get dimension slots", () => {
    const grapher = new Grapher()
    expect(grapher.dimensionSlots.length).toBe(1)

    grapher.type = ChartTypeName.ScatterPlot
    expect(grapher.dimensionSlots.length).toBe(4)
})

it("an empty Grapher serializes to an empty object", () => {
    expect(new Grapher().toObject()).toEqual({})
})

it("does not preserve defaults in the object", () => {
    expect(new Grapher({ tab: GrapherTabOption.chart }).toObject()).toEqual({})
})

it("can apply legacy chart dimension settings", () => {
    const unit = "% of children under 5"
    const name = "Some display name"
    const grapher = new Grapher({
        dimensions: [
            {
                variableId: 3512,
                property: DimensionProperty.y,
                display: {
                    unit,
                },
            },
        ],
        owidDataset: {
            variables: {
                "3512": {
                    years: [2000, 2010, 2010],
                    entities: [207, 15, 207],
                    values: [4, 20, 34],
                    id: 3512,
                    display: {
                        name,
                    },
                },
            },
            entityKey: {
                "15": { name: "Afghanistan", id: 15, code: "AFG" },
                "207": { name: "Iceland", id: 207, code: "ISL" },
            },
        },
    })
    const col = grapher.yColumns[0]!
    expect(col.unit).toEqual(unit)
    expect(col.displayName).toEqual(name)
})
