import { describe, expect, it } from "vitest"
import { ExplorerType, OwidColumnDef } from "@ourworldindata/types"
import { ExplorerProgram } from "@ourworldindata/explorer"
import {
    addDuplicateYVariableIds,
    getExplorerType,
} from "./explorerViewsLogic.js"
import { ExplorerViewBaseRecord } from "./types.js"

function makeRecord(
    overrides: Partial<ExplorerViewBaseRecord>
): ExplorerViewBaseRecord {
    return {
        explorerType: ExplorerType.Indicator,
        availableEntities: [],
        numNonDefaultSettings: 0,
        viewIndexWithinExplorer: 0,
        viewQueryParams: "",
        viewId: "",
        viewSettings: [],
        ySlugs: [],
        yVariableIds: [],
        explorerSlug: "test-explorer",
        ...overrides,
    }
}

function getExplorerTypesOfAllViews(code: string): ExplorerType[] {
    const program = new ExplorerProgram("test-explorer", code)
    return program.decisionMatrix.allDecisionsAsQueryParams().map((choice) => {
        program.decisionMatrix.setValuesFromChoiceParams(choice)
        return getExplorerType(program)
    })
}

describe(getExplorerType, () => {
    // A view that references an indicator only through a `duplicate` column
    // has no yVariableIds of its own, but Explorer still renders it from
    // variable IDs. It must not be indexed as a CSV view, which would need a
    // tableSlug and get dropped from search.
    it("types every view of an indicator explorer as an indicator view", () => {
        const code = `graphers
	Metric Radio	yVariableIds	ySlugs
	Population	953297
	Population (low)		population_low

columns
	slug	transform
	population_low	duplicate 953298`

        expect(getExplorerTypesOfAllViews(code)).toEqual([
            ExplorerType.Indicator,
            ExplorerType.Indicator,
        ])
    })

    it("types views of a grapher explorer as grapher views", () => {
        const code = `graphers
	grapherId	Metric Radio
	35	GDP
	46	Population`

        expect(getExplorerTypesOfAllViews(code)).toEqual([
            ExplorerType.Grapher,
            ExplorerType.Grapher,
        ])
    })

    it("types views of a CSV explorer as CSV views", () => {
        const code = `graphers
	Metric Radio	tableSlug	ySlugs
	GDP	gdp_table	gdp`

        expect(getExplorerTypesOfAllViews(code)).toEqual([ExplorerType.Csv])
    })
})

describe(addDuplicateYVariableIds, () => {
    const duplicateTransforms: OwidColumnDef[] = [
        { slug: "population_low", transform: "duplicate 953298" },
        { slug: "population_high", transform: "duplicate 953299" },
    ]

    it("resolves ySlugs that point at duplicate columns to variable IDs", () => {
        const [record] = addDuplicateYVariableIds(
            [
                makeRecord({
                    ySlugs: ["population_low", "population_high"],
                    yVariableIds: [953297],
                }),
            ],
            duplicateTransforms
        )

        expect(record.yVariableIds).toEqual([953297, 953298, 953299])
    })

    it("ignores ySlugs that aren't duplicate columns", () => {
        const [record] = addDuplicateYVariableIds(
            [makeRecord({ ySlugs: ["gdp"] })],
            duplicateTransforms
        )

        expect(record.yVariableIds).toEqual([])
    })
})
