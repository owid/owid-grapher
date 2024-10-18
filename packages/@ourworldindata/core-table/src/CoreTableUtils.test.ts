#! /usr/bin/env jest

import { ColumnTypeNames, CoreMatrix, Time } from "@ourworldindata/types"
import {
    emptyColumnsInFirstRowInDelimited,
    getDropIndexes,
    toleranceInterpolation,
    matrixToDelimited,
    parseDelimited,
    rowsToMatrix,
    sortColumnStore,
    trimArray,
    trimEmptyRows,
    trimMatrix,
    linearInterpolation,
    concatColumnStores,
    guessColumnDefFromSlugAndRow,
    standardizeSlugs,
    parseDelimitedV2,
} from "./CoreTableUtils.js"
import { ErrorValueTypes } from "./ErrorValues.js"
import { imemo } from "@ourworldindata/utils"

describe(toleranceInterpolation, () => {
    it("handles empty array", () => {
        const valArr: number[] = []
        const timesArr: Time[] = []
        toleranceInterpolation(valArr, timesArr, {
            timeToleranceBackwards: 2,
            timeToleranceForwards: 2,
        })
        expect(valArr).toEqual([])
        expect(timesArr).toEqual([])
    })
    it("handles undefined values with infinite tolerance", () => {
        // This is an edge case that can cause problems
        const valArr = [undefined]
        const timesArr = [0]
        toleranceInterpolation(valArr as any[], timesArr, {
            timeToleranceBackwards: Infinity,
            timeToleranceForwards: Infinity,
        })
        expect(valArr).toEqual([ErrorValueTypes.NoValueWithinTolerance])
        expect(timesArr).toEqual([0])
    })
    it("leaves array unchanged if tolerance = 0", () => {
        const valArr = [1, undefined, undefined, 3]
        const timesArr = [0, 1, 2, 3]
        toleranceInterpolation(valArr as any[], timesArr, {
            timeToleranceBackwards: 0,
            timeToleranceForwards: 0,
        })
        expect(valArr).toEqual([
            1,
            ErrorValueTypes.NoValueWithinTolerance,
            ErrorValueTypes.NoValueWithinTolerance,
            3,
        ])
    })
    it("fills in gaps in simple case", () => {
        const valArr = [1, undefined, undefined, 3]
        const timesArr = [0, 1, 2, 3]
        toleranceInterpolation(valArr as any[], timesArr, {
            timeToleranceBackwards: 2,
            timeToleranceForwards: 2,
        })
        expect(valArr).toEqual([1, 1, 3, 3])
        expect(timesArr).toEqual([0, 0, 3, 3])
    })
    it("fills in initial and trailing values", () => {
        const valArr = [
            undefined,
            ErrorValueTypes.NaNButShouldBeNumber,
            1,
            ErrorValueTypes.UndefinedButShouldBeNumber,
            undefined,
            undefined,
            3,
            undefined,
        ]
        const timesArr = [0, 1, 2, 3, 4, 5, 6, 7]
        toleranceInterpolation(valArr as any[], timesArr, {
            timeToleranceBackwards: 1,
            timeToleranceForwards: 1,
        })
        expect(valArr).toEqual([
            ErrorValueTypes.NoValueWithinTolerance,
            1,
            1,
            1,
            ErrorValueTypes.NoValueWithinTolerance,
            3,
            3,
            3,
        ])
        expect(timesArr).toEqual([0, 2, 2, 2, 4, 6, 6, 6])
    })
    it("handles infinity tolerance", () => {
        const valArr = [
            undefined,
            ErrorValueTypes.NaNButShouldBeNumber,
            1,
            undefined,
            undefined,
        ]
        const timesArr = [0, 1, 2, 3, 4]
        toleranceInterpolation(valArr as any[], timesArr, {
            timeToleranceBackwards: Infinity,
            timeToleranceForwards: Infinity,
        })
        expect(valArr).toEqual([1, 1, 1, 1, 1])
        expect(timesArr).toEqual([2, 2, 2, 2, 2])
    })

    it("doesn't interpolate values beyond end", () => {
        const valuesAsc = [
            1,
            ErrorValueTypes.MissingValuePlaceholder,
            ErrorValueTypes.MissingValuePlaceholder,
            2,
        ]
        const timesAsc = [0, 1, 2, 3]
        const tolerance = 1
        toleranceInterpolation(
            valuesAsc,
            timesAsc,
            {
                timeToleranceForwards: tolerance,
                timeToleranceBackwards: tolerance,
            },
            0,
            3
        )
        expect(valuesAsc).toEqual([
            1,
            1,
            ErrorValueTypes.MissingValuePlaceholder,
            2,
        ])
    })

    it("interpolates values in both directions", () => {
        const valuesAsc = [
            ErrorValueTypes.MissingValuePlaceholder,
            1,
            ErrorValueTypes.MissingValuePlaceholder,
            ErrorValueTypes.MissingValuePlaceholder,
            2,
            ErrorValueTypes.MissingValuePlaceholder,
        ]
        const timesAsc = [0, 1, 2, 3, 4, 5]
        const tolerance = 1
        toleranceInterpolation(valuesAsc, timesAsc, {
            timeToleranceForwards: tolerance,
            timeToleranceBackwards: tolerance,
        })
        expect(valuesAsc).toEqual([1, 1, 1, 2, 2, 2])
    })

    it("interpolates values in the backwards direction", () => {
        const valuesAsc = [
            ErrorValueTypes.MissingValuePlaceholder,
            1,
            ErrorValueTypes.MissingValuePlaceholder,
            ErrorValueTypes.MissingValuePlaceholder,
            2,
            ErrorValueTypes.MissingValuePlaceholder,
        ]
        const timesAsc = [0, 1, 2, 3, 4, 5]
        const tolerance = 1
        toleranceInterpolation(valuesAsc, timesAsc, {
            timeToleranceForwards: 0,
            timeToleranceBackwards: tolerance,
        })
        expect(valuesAsc).toEqual([
            ErrorValueTypes.NoValueWithinTolerance,
            1,
            1,
            ErrorValueTypes.NoValueWithinTolerance,
            2,
            2,
        ])
    })

    it("interpolates values in the forwards direction", () => {
        const valuesAsc = [
            ErrorValueTypes.MissingValuePlaceholder,
            1,
            ErrorValueTypes.MissingValuePlaceholder,
            ErrorValueTypes.MissingValuePlaceholder,
            2,
            ErrorValueTypes.MissingValuePlaceholder,
        ]
        const timesAsc = [0, 1, 2, 3, 4, 5]
        const tolerance = 1
        toleranceInterpolation(valuesAsc, timesAsc, {
            timeToleranceForwards: tolerance,
            timeToleranceBackwards: 0,
        })
        expect(valuesAsc).toEqual([
            1,
            1,
            ErrorValueTypes.NoValueWithinTolerance,
            2,
            2,
            ErrorValueTypes.NoValueWithinTolerance,
        ])
    })
})

describe(linearInterpolation, () => {
    it("interpolates, with extrapolation", () => {
        const values = [
            4,
            ErrorValueTypes.MissingValuePlaceholder,
            ErrorValueTypes.MissingValuePlaceholder,
            1,
            ErrorValueTypes.MissingValuePlaceholder,
        ]
        const timesAsc = [0, 1, 2, 3, 4]
        linearInterpolation(values, timesAsc, {
            extrapolateAtStart: true,
            extrapolateAtEnd: true,
        })
        expect(values).toEqual([4, 3, 2, 1, 1])
    })

    it("interpolates, without extrapolation", () => {
        const values = [
            4,
            ErrorValueTypes.MissingValuePlaceholder,
            ErrorValueTypes.MissingValuePlaceholder,
            1,
            ErrorValueTypes.MissingValuePlaceholder,
        ]
        const timesAsc = [0, 1, 2, 3, 4]
        linearInterpolation(values, timesAsc, {})
        expect(values).toEqual([
            4,
            3,
            2,
            1,
            ErrorValueTypes.NoValueForInterpolation,
        ])
    })
})

describe("immutable memoization", (): void => {
    class WeatherForecast {
        conditions = "rainy"

        @imemo get forecast(): string {
            return this.conditions
        }
    }

    it("runs getters once", () => {
        const forecast = new WeatherForecast()
        expect(forecast.forecast).toEqual("rainy")

        forecast.conditions = "sunny"
        expect(forecast.forecast).toEqual("rainy")

        const forecast2 = new WeatherForecast()
        forecast2.conditions = "sunny"
        expect(forecast2.forecast).toEqual("sunny")
    })
})

it("can get indexes of cell values to drop in an array", () => {
    const drops = getDropIndexes(3, 2, 1)
    expect(
        [1, 2, 3].map((value, index) => (drops.has(index) ? undefined : value))
    ).toEqual([undefined, undefined, 3])
})

describe("matrix methods", () => {
    it("turns an array of objects into arrays", () => {
        const str = `gdp,pop
1,2`
        expect(rowsToMatrix(parseDelimited(str))).toEqual([
            ["gdp", "pop"],
            ["1", "2"],
        ])

        expect(rowsToMatrix(parseDelimited(""))).toEqual(undefined)

        expect(
            matrixToDelimited(rowsToMatrix(parseDelimited(str))!, ",")
        ).toEqual(str)
    })

    it("handles extra blank cells", () => {
        const table = rowsToMatrix(
            parseDelimited(`gdp pop code
123 345 usa
`)
        )
        expect(matrixToDelimited(trimMatrix(table!), " ")).toEqual(`gdp pop code
123 345 usa`)
    })

    it("can trim an array", () => {
        expect(trimArray([1, "2", "", null, undefined])).toEqual([1, "2"])
        const test = [1, "2", "", null, undefined, 1]
        expect(trimArray(test)).toEqual(test)
    })
})

describe(parseDelimited, () => {
    it("detects delimiter and parses delimited", () => {
        const str = `foo,bar
1,2`
        expect(parseDelimited(str)).toEqual(
            parseDelimited(str.replace(/,/g, "\t"))
        )
    })
})

describe(guessColumnDefFromSlugAndRow, () => {
    it("can guess column defs", () => {
        const tests = [{ slug: "Entity", example: "USA" }]
        tests.forEach((testCase) => {
            expect(
                guessColumnDefFromSlugAndRow(testCase.slug, testCase.example)
                    .type
            ).toEqual(ColumnTypeNames.EntityName)
        })
    })
})

describe(standardizeSlugs, () => {
    it("can handle empty rows", () => {
        expect(standardizeSlugs([])).toEqual(undefined)
    })
})

describe(emptyColumnsInFirstRowInDelimited, () => {
    it("detects slugs needing reparsing", () => {
        const str = `location,new_cases,new_tests
usa,,
canada,,`
        expect(emptyColumnsInFirstRowInDelimited(str)).toEqual([
            "new_cases",
            "new_tests",
        ])

        expect(emptyColumnsInFirstRowInDelimited("")).toEqual([])
    })
})

describe(trimEmptyRows, () => {
    it("trims rows", () => {
        const testCases: { input: CoreMatrix; length: number }[] = [
            {
                input: [["pop"], [123], [null], [""], [undefined]],
                length: 2,
            },
            {
                input: [[]],
                length: 0,
            },
            {
                input: [
                    ["pop", "gdp"],
                    [123, 345],
                    [undefined, 456],
                ],
                length: 3,
            },
        ]

        testCases.forEach((testCase) => {
            expect(trimEmptyRows(testCase.input).length).toEqual(
                testCase.length
            )
        })
    })
})

describe(sortColumnStore, () => {
    it("can sort", () => {
        const columnStore = {
            countries: ["usa", "can", "mex"],
            pops: [123, 21, 99],
        }
        const result = sortColumnStore(columnStore, ["pops"])
        expect(result["pops"]).toEqual([21, 99, 123])
        expect(result["countries"]).toEqual(["can", "mex", "usa"])
        expect(result).not.toBe(columnStore)
    })

    it("can detect a sorted array and leave it untouched", () => {
        const columnStore = {
            countries: ["usa", "can", "mex"],
            pops: [21, 99, 123],
        }
        const result = sortColumnStore(columnStore, ["pops"])
        expect(result["pops"]).toEqual([21, 99, 123])
        expect(result).toBe(columnStore)
    })
})

describe(concatColumnStores, () => {
    it("concats stores with matching columns", () => {
        expect(
            concatColumnStores([
                {
                    a: [1, 2],
                    b: [5, 6],
                },
                {
                    a: [3, 4],
                    b: [7, 8],
                },
            ])
        ).toEqual({
            a: [1, 2, 3, 4],
            b: [5, 6, 7, 8],
        })
    })

    it("concats column stores with missing columns", () => {
        expect(
            concatColumnStores([
                {
                    a: [1, 2],
                    b: [6, 7],
                },
                {
                    a: [3, 4],
                    c: [0, 0],
                },
                { a: [5], b: [8] },
            ])
        ).toEqual({
            a: [1, 2, 3, 4, 5],
            b: [
                6,
                7,
                ErrorValueTypes.MissingValuePlaceholder,
                ErrorValueTypes.MissingValuePlaceholder,
                8,
            ],
        })
    })

    it("fills empty values", () => {
        expect(
            concatColumnStores([
                {
                    a: [1],
                    b: [2],
                },
                { a: [3], b: [] },
            ])
        ).toEqual({
            a: [1, 3],
            b: [2, ErrorValueTypes.MissingValuePlaceholder],
        })
        expect(
            concatColumnStores([
                {
                    a: [1],
                    b: [2],
                },
                { a: [3] },
            ])
        ).toEqual({
            a: [1, 3],
            b: [2, ErrorValueTypes.MissingValuePlaceholder],
        })
        expect(
            concatColumnStores([
                {
                    a: [],
                    b: [2],
                },
                { a: [3] },
            ])
        ).toEqual({
            a: [ErrorValueTypes.MissingValuePlaceholder, 3],
            b: [2, ErrorValueTypes.MissingValuePlaceholder],
        })
    })

    it("respects slugsToKeep param", () => {
        expect(
            concatColumnStores(
                [
                    {
                        a: [1, 2],
                        b: [6, 7],
                    },
                    {
                        a: [3, 4],
                        c: [0, 0],
                    },
                    { a: [5], b: [8] },
                ],
                ["a", "c"]
            )
        ).toEqual({
            a: [1, 2, 3, 4, 5],
            c: [
                ErrorValueTypes.MissingValuePlaceholder,
                ErrorValueTypes.MissingValuePlaceholder,
                0,
                0,
                ErrorValueTypes.MissingValuePlaceholder,
            ],
        })
    })
})

describe("parseDelimited and parseDelimitedV2", () => {
    it("Both functions should return the same result", () => {
        const input = `grapherId	yVariableIds	xVariableId	colorVariableId	sizeVariableId	Metric	Period	Sub-Metric	Age	subtitle	title	hasMapTab	tab	yAxisMin	timelineMaxTime	relatedQuestionText	relatedQuestionUrl
	953987				International emigrants	Total number	Total	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	954094				International emigrants	Total number	Per capita / Share of population	All ages		Share of the population that has left the country	true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	954091				International emigrants	Five-year change	Total	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	954093				International emigrants	Five-year change	Per capita / Share of population	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	953981				International immigrants	Total number	Total	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	953985				International immigrants	Total number	Per capita / Share of population	All ages		Share of the population that was born in another country	true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	954090				International immigrants	Five-year change	Total	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	954092				International immigrants	Five-year change	Per capita / Share of population	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962002				International immigrants	Total number	Total	Under 18			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962010				International immigrants	Total number	Per capita / Share of population	Under 18			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	951638				Net migration	Total number	Total	All ages	The total number of [immigrants](#dod:immigrant) (people moving into a given country) minus the number of [emigrants](#dod:emigrant) (people moving out of the country).	Net migration	true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	951642				Net migration	Total number	Per capita / Share of population	All ages	The total number of [immigrants](#dod:immigrant) (people moving into a given country) minus the number of [emigrants](#dod:emigrant) (people moving out of the country), per 1,000 people in the population.	Net migration rate	true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962012				Asylum seekers by origin	Total number	Total	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962033				Asylum seekers by origin	Total number	Per capita / Share of population	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962018				Asylum seekers by destination	Total number	Total	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962034				Asylum seekers by destination	Total number	Per capita / Share of population	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962011				Refugees by origin	Total number	Total	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962031				Refugees by origin	Total number	Per capita / Share of population	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962006				Refugees by origin	Total number	Total	Under 18			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962009				Refugees by origin	Total number	Per capita / Share of population	Under 18			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962019				Refugees by destination	Total number	Total	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962032				Refugees by destination	Total number	Per capita / Share of population	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962005				Refugees by destination	Total number	Total	Under 18			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962008				Refugees by destination	Total number	Per capita / Share of population	Under 18			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962026				Resettled refugees by origin	Annual change	Total	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962035				Resettled refugees by origin	Annual change	Per capita / Share of population	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962029				Resettled refugees by destination	Annual change	Total	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962036				Resettled refugees by destination	Annual change	Per capita / Share of population	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962024				Returned refugees by origin	Annual change	Total	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962028				Returned refugees by destination	Annual change	Total	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962052				Internally displaced persons	Total number	Total	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962056				Internally displaced persons	Total number	Per capita / Share of population	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962055				Internally displaced persons	Annual change	Total	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	985134				Internally displaced persons	Annual change	Per capita / Share of population	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962000				Internally displaced persons	Total number	Total	Under 18			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	985135				Internally displaced persons	Total number	Per capita / Share of population	Under 18			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962004				Internally displaced persons	Annual change	Total	Under 18			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	985136				Internally displaced persons	Annual change	Per capita / Share of population	Under 18			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962050				Internally displaced persons (conflict)	Total number	Total	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962057				Internally displaced persons (conflict)	Total number	Per capita / Share of population	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962053				Internally displaced persons (conflict)	Annual change	Total	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	985137				Internally displaced persons (conflict)	Annual change	Per capita / Share of population	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	961999				Internally displaced persons (conflict)	Total number	Total	Under 18			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	985139				Internally displaced persons (conflict)	Total number	Per capita / Share of population	Under 18			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962001				Internally displaced persons (conflict)	Annual change	Total	Under 18			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	985141				Internally displaced persons (conflict)	Annual change	Per capita / Share of population	Under 18			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962051				Internally displaced persons (disaster)	Total number	Total	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962058				Internally displaced persons (disaster)	Total number	Per capita / Share of population	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962054				Internally displaced persons (disaster)	Annual change	Total	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	985138				Internally displaced persons (disaster)	Annual change	Per capita / Share of population	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	961998				Internally displaced persons (disaster)	Total number	Total	Under 18			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	985140				Internally displaced persons (disaster)	Total number	Per capita / Share of population	Under 18			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962003				Internally displaced persons (disaster)	Annual change	Total	Under 18			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	985142				Internally displaced persons (disaster)	Annual change	Per capita / Share of population	Under 18			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962025				Returned internally displaced persons	Annual change	Total	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	985145				Returned internally displaced persons	Annual change	Per capita / Share of population	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	962021				Stateless persons by residence	Total number	Total	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	985147				Stateless persons by residence	Total number	Per capita / Share of population	All ages			true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	904891				Remittances as share of GDP	Total number	Total	All ages	Share of GDP that is made up of the sum of all personal [remittances](#dod:remittances) sent by migrants to their home countries.	Remittances as share of GDP	true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	905930				Cost of sending remittances	Total number	Total	All ages	The average [transaction cost](#dod:remittancecost) as a percentage of total [remittance](#dod:remittances) received from abroad. The cost is based on a single transaction of USD 200.	Average cost for sending remittances from country	true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition
	905929				Cost of receiving remittances	Total number	Total	All ages	The average [transaction cost](#dod:remittancecost) as a percentage of total [remittance](#dod:remittances) sent from abroad to this country. The cost is based on a single transaction of USD 200.	Average cost for sending remittances to country	true	map	0	2024	Migration Data: Our sources and definitions	https://ourworldindata.org/migration-definition`
        const resultV1 = parseDelimited(input)
        const resultV2 = parseDelimitedV2(input)
        expect(resultV1).toEqual(resultV2)
    })
})
