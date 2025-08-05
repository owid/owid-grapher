import { expect, it, describe, vi } from "vitest"

import timezoneMock from "timezone-mock"
import {
    findClosestTime,
    formatDay,
    retryPromise,
    rollingMap,
    next,
    previous,
    intersectionOfSets,
    roundSigFig,
    anyToString,
    sortNumeric,
    lowerCaseFirstLetterUnlessAbbreviation,
    trimObject,
    getRandomNumberGenerator,
    findClosestTimeIndex,
    intersection,
    getClosestTimePairs,
    differenceObj,
    numberMagnitude,
    urlToSlug,
    toRectangularMatrix,
    slugifySameCase,
    greatestCommonDivisor,
    findGreatestCommonDivisorOfArray,
    traverseEnrichedBlock,
    cartesian,
    formatInlineList,
    flattenNonTopicNodes,
    imemo,
} from "./Util.js"
import {
    BlockImageSize,
    OwidEnrichedGdocBlock,
    SortOrder,
    TagGraphRoot,
} from "@ourworldindata/types"

describe(findClosestTime, () => {
    describe("without tolerance", () => {
        describe("array", () => {
            it("returns the correct year", () => {
                const years = [2010, 2015, 2017]
                expect(findClosestTime(years, 2015, 0)).toEqual(2015)
            })
            it("returns undefined", () => {
                const years = [2010, 2015, 2017]
                expect(findClosestTime(years, 2014, 0)).toEqual(undefined)
            })

            it("can also get the index", () => {
                const years = [2010, 2015, 2017]
                expect(findClosestTimeIndex(years, 2014, 1)).toEqual(1)
            })
        })
    })

    describe("specified tolerance", () => {
        it("returns the closest year within the specified tolerance", () => {
            const years = [2010, 2015, 2017]
            expect(findClosestTime(years, 2013, 2)).toEqual(2015)
        })
        it("returns undefined outside the tolerance", () => {
            const years = [2010, 2017]
            expect(findClosestTime(years, 2014, 1)).toEqual(undefined)
        })
        it("prefers later years", () => {
            const years = [2010, 2012, 2013, 2017]
            expect(findClosestTime(years, 2011, 3)).toEqual(2012)
            expect(findClosestTime(years, 2015, 3)).toEqual(2017)
        })
    })

    describe("unspecified tolerance", () => {
        it("returns the closest year", () => {
            const years = [1990, 2016]
            expect(findClosestTime(years, 2013)).toEqual(2016)
            expect(findClosestTime(years, 2002)).toEqual(1990)
        })
    })

    describe("negative numbers", () => {
        it("works with negative years and zero", () => {
            const years = [-100, 0, 100]
            expect(findClosestTime(years, 0)).toEqual(0)
            expect(findClosestTime(years, 1)).toEqual(0)
            expect(findClosestTime(years, -1)).toEqual(0)
            expect(findClosestTime(years, -99)).toEqual(-100)
            expect(findClosestTime(years, 99)).toEqual(100)
        })
    })
})

describe(next, () => {
    const scenarios = [
        {
            list: [55, 33, 22],
            current: 33,
            next: 22,
            previous: 55,
        },
        {
            list: [55, 33, 22],
            current: 44,
            next: 55,
            previous: 22,
        },
        {
            list: [55, 33, 22],
            current: 22,
            next: 55,
            previous: 33,
        },
        {
            list: [55, 33, 22],
            current: 55,
            next: 33,
            previous: 22,
        },
        {
            list: [55],
            current: 55,
            next: 55,
            previous: 55,
        },
    ]
    it("iterates correctly", () => {
        scenarios.forEach((scenario) => {
            expect(next(scenario.list, scenario.current)).toBe(scenario.next)
            expect(previous(scenario.list, scenario.current)).toBe(
                scenario.previous
            )
        })
    })
})

describe("random functions", () => {
    it("can generate a repeatable sequence of random numbers between 1 and 100 given a seed", () => {
        const rand = getRandomNumberGenerator(1, 100, 123)
        expect([rand(), rand()]).toEqual([96, 13])
    })
})

describe(formatDay, () => {
    describe("timezones", () => {
        it("formats date consistently in GMT", () => {
            timezoneMock.register("Europe/London")
            expect(formatDay(0)).toEqual("Jan 21, 2020")
            timezoneMock.unregister()
        })

        it("formats date consistently in US/Pacific", () => {
            timezoneMock.register("US/Pacific")
            expect(formatDay(0)).toEqual("Jan 21, 2020")
            timezoneMock.unregister()
        })

        it("formats date consistently in US/Pacific", () => {
            timezoneMock.register("Australia/Adelaide")
            expect(formatDay(0)).toEqual("Jan 21, 2020")
            timezoneMock.unregister()
        })
    })

    describe("epoch", () => {
        it("starts on Jan 21, 2020", () => {
            expect(formatDay(0)).toEqual("Jan 21, 2020")
        })

        it("handles increments", () => {
            expect(formatDay(11)).toEqual("Feb 1, 2020")
        })

        it("handles decrements", () => {
            expect(formatDay(-21)).toEqual("Dec 31, 2019")
        })
    })
})

describe(retryPromise, () => {
    function resolveAfterNthRetry(
        nth: number,
        message = "success"
    ): () => Promise<string> {
        let retried = 0
        return (): Promise<string> =>
            new Promise((resolve, reject) =>
                retried++ >= nth ? resolve(message) : reject()
            )
    }

    it("resolves when promise succeeds first-time", async () => {
        const promiseGetter = resolveAfterNthRetry(0, "success")
        return expect(
            retryPromise(promiseGetter, { maxRetries: 1 })
        ).resolves.toEqual("success")
    })

    it("resolves when promise succeeds before retry limit", async () => {
        const promiseGetter = resolveAfterNthRetry(2, "success")
        return expect(
            retryPromise(promiseGetter, { maxRetries: 3 })
        ).resolves.toEqual("success")
    })

    it("rejects when promise doesn't succeed within retry limit", async () => {
        const promiseGetter = resolveAfterNthRetry(3, "success")
        return expect(
            retryPromise(promiseGetter, { maxRetries: 3 })
        ).rejects.toBeUndefined()
    })
})

describe(rollingMap, () => {
    it("handles empty arrays", () => {
        expect(rollingMap([], () => undefined).length).toEqual(0)
    })
    it("handles arrays with 1 element", () => {
        expect(rollingMap([1], (a, b) => a + b).length).toEqual(0)
    })
    it("handles arrays with multiple elements", () => {
        expect(rollingMap([1, 2, 4, 8], (a, b) => b - a)).toEqual([1, 2, 4])
    })
})

describe("intersection", () => {
    const groupA = ["a", "b", "c"]
    const groupB = ["a", "b", "c", "d"]
    const groupC = ["a", "c", "d"]
    const groupD = ["a", "c", "d"]
    const groupE = [""]
    it("can compute intersections", () => {
        expect(intersection(groupA, groupB)).toEqual(["a", "b", "c"])
        expect(intersection(groupA, groupE)).toEqual([])
        expect(intersection([], [])).toEqual([])
        expect(intersection(groupA, groupA)).toEqual(groupA)
        expect(intersection(groupE, groupE)).toEqual([""])
        expect(intersection(groupA, groupB, groupC)).toEqual(["a", "c"])
    })

    it("can detect set intersections", () => {
        const setA = new Set(groupA)
        const setB = new Set(groupB)
        const setC = new Set(groupC)
        const setD = new Set(groupD)
        const setE = new Set(groupE)

        expect(
            Array.from(intersectionOfSets([setA, setB, setC, setD]).values())
        ).toEqual(["a", "c"])
        expect(
            Array.from(
                intersectionOfSets([setA, setB, setC, setD, setE]).values()
            )
        ).toEqual([])
        expect(intersectionOfSets([]).size).toEqual(new Set().size)
    })
})

describe("anyToString", () => {
    const values = [
        false,
        0,
        1,
        "0",
        "1",
        null,
        undefined,
        "false",
        "true",
        NaN,
        Infinity,
        {},
        0.1,
    ]
    const expected = [
        "false",
        "0",
        "1",
        "0",
        "1",
        "",
        "",
        "false",
        "true",
        "NaN",
        "Infinity",
        "[object Object]",
        "0.1",
    ]
    it("handles edge cases in format value", () => {
        expect(values.map(anyToString)).toEqual(expected)
    })
})

describe(trimObject, () => {
    it("trims an object", () => {
        expect(trimObject({ foo: undefined })).toEqual({})
        expect(trimObject({ foo: {} })).toEqual({})
        expect(trimObject({ foo: undefined, bar: 1 })).toEqual({ bar: 1 })
        expect(trimObject({ foo: undefined, bar: 1, test: "" })).toEqual({
            bar: 1,
            test: "",
        })
        expect(trimObject({ foo: undefined, bar: 1, test: "" }, true)).toEqual({
            bar: 1,
        })
    })
})

describe(numberMagnitude, () => {
    it("0 has magnitude 0", () => expect(numberMagnitude(0)).toEqual(0))
    it("1 has magnitude 1", () => expect(numberMagnitude(1)).toEqual(1))
    it("1.1 has magnitude 1", () => expect(numberMagnitude(1.1)).toEqual(1))
    it("-10 has magnitude 2", () => expect(numberMagnitude(-10)).toEqual(2))
    it("11 has magnitude 2", () => expect(numberMagnitude(11)).toEqual(2))
    it("0.02 has magnitude -1", () => expect(numberMagnitude(0.02)).toEqual(-1))
    it("0.5 has magnitude 0", () => expect(numberMagnitude(0.5)).toEqual(0))
})

describe(roundSigFig, () => {
    it("rounds to 1 sig fig by default", () => {
        expect(roundSigFig(652)).toEqual(700)
    })

    it("rounds integer to provided sig figs", () => {
        expect(roundSigFig(652, 2)).toEqual(650)
    })

    it("rounds floating point to provided sig figs", () => {
        expect(roundSigFig(0.00652, 1)).toEqual(0.007)
    })

    it("rounds negative values to provided sig figs", () => {
        expect(roundSigFig(-652, 1)).toEqual(-700)
    })

    it("leaves zero unchanged", () => {
        expect(roundSigFig(0, 2)).toEqual(0)
    })
})

describe(lowerCaseFirstLetterUnlessAbbreviation, () => {
    it("works", () => {
        expect(lowerCaseFirstLetterUnlessAbbreviation("GDP")).toEqual("GDP")
        expect(lowerCaseFirstLetterUnlessAbbreviation("Change in")).toEqual(
            "change in"
        )
    })
})

describe(sortNumeric, () => {
    it("sorts numeric values", () => {
        expect(sortNumeric([3, 4, 2, 1, 3, 8])).toEqual([1, 2, 3, 3, 4, 8])
    })

    it("sorts numeric values in ascending value", () => {
        expect(
            sortNumeric([3, 4, 2, 1, 3, 8], undefined, SortOrder.asc)
        ).toEqual([1, 2, 3, 3, 4, 8])
    })

    it("sorts numeric values in descending order", () => {
        expect(
            sortNumeric([3, 4, 2, 1, 3, 8], undefined, SortOrder.desc)
        ).toEqual([8, 4, 3, 3, 2, 1])
    })

    it("sorts objects using a sortBy function", () => {
        expect(
            sortNumeric(
                [{ a: 3 }, { a: 4 }, { a: 2 }, { a: 1 }, { a: 3 }, { a: 8 }],
                (o) => o.a
            )
        ).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }, { a: 3 }, { a: 4 }, { a: 8 }])
    })
})

describe(getClosestTimePairs, () => {
    it("case 1", () => {
        expect(getClosestTimePairs([0, 4], [3, 4])).toEqual(
            expect.arrayContaining([
                [0, 3],
                [4, 4],
            ])
        )
    })

    it("case 2", () => {
        expect(getClosestTimePairs([0, 5, 6, 8], [3, 7])).toEqual(
            expect.arrayContaining([
                [5, 3],
                [6, 7],
            ])
        )
    })

    it("case 3", () => {
        expect(getClosestTimePairs([0, 1, 2], [2])).toEqual(
            expect.arrayContaining([[2, 2]])
        )
    })

    it("case 4", () => {
        expect(getClosestTimePairs([0, 1], [2])).toEqual(
            expect.arrayContaining([[1, 2]])
        )
    })

    it("case 5", () => {
        expect(getClosestTimePairs([5, 6], [1])).toEqual(
            expect.arrayContaining([[5, 1]])
        )
    })

    it("case 6", () => {
        expect(getClosestTimePairs([0, 1], [2, 3])).toEqual(
            expect.arrayContaining([[1, 2]])
        )
    })

    it("case 7", () => {
        expect(getClosestTimePairs([2, 3], [0, 1])).toEqual(
            expect.arrayContaining([[2, 1]])
        )
    })

    it("case 8", () => {
        expect(getClosestTimePairs([0, 4], [3])).toEqual(
            expect.arrayContaining([[4, 3]])
        )
    })

    describe("with maxDiff", () => {
        it("case 1", () => {
            expect(getClosestTimePairs([0, 1], [2, 3], 1)).toEqual([[1, 2]])
        })

        it("case 2", () => {
            expect(getClosestTimePairs([0, 1], [3, 4], 1)).toEqual([])
        })

        it("case 3", () => {
            expect(getClosestTimePairs([2, 3], [0], 2)).toEqual([[2, 0]])
        })

        it("case 4", () => {
            expect(getClosestTimePairs([2, 3], [0], 1)).toEqual([])
        })
    })
})

describe(differenceObj, () => {
    it("handles empty objects", () => {
        expect(differenceObj({}, {})).toEqual({})
        expect(differenceObj({ a: 1 }, {})).toEqual({ a: 1 })
        expect(differenceObj({}, { a: 1 })).toEqual({})
    })
    it("discards values that don't strictly equal values on reference object", () => {
        expect(
            differenceObj({ a: 1, b: 2, c: 3 }, { a: 1, b: 3, d: 4 })
        ).toEqual({ b: 2, c: 3 })
    })
})

describe(urlToSlug, () => {
    const slug = "covid-vaccinations"
    it("gets slug from full url", () => {
        expect(urlToSlug(`https://ourworldindata.org/${slug}#anchor`)).toEqual(
            `${slug}`
        )
    })
    it("gets slug from multi-level path", () => {
        expect(urlToSlug(`/coronavirus/${slug}`)).toEqual(`${slug}`)
    })
})

describe(toRectangularMatrix, () => {
    it("converts a non-rectangular array to a rectangular one", () => {
        const arr = [
            [1, 2],
            [1, 2, 3, 4],
        ]
        const expected = [
            [1, 2, undefined, undefined],
            [1, 2, 3, 4],
        ]
        expect(toRectangularMatrix(arr, undefined)).toEqual(expected)
    })
})

describe("slugifySameCase", () => {
    const cases = [
        [" *hello world*   ", ""],
        [" *hello world*afterwards   ", "afterwards"],
        [" *hello world*afterwards one two  ", "afterwards-one-two"],
        ["with-dashes", "with-dashes"],
        ["//", ""],
        ["hello//world", "helloworld"],
        ["  hello//world  ", "helloworld"],
    ]

    it("slugifies strings", () => {
        cases.forEach(([input, output]) => {
            expect(slugifySameCase(input)).toBe(output)
        })
    })

    it("can allow slashes", () => {
        expect(slugifySameCase("sdgs/energy", true)).toBe("sdgs/energy")
        expect(slugifySameCase("sdgs/economic development", true)).toBe(
            "sdgs/economic-development"
        )
    })
})

describe(greatestCommonDivisor, () => {
    it("returns the greatest common divisor of two numbers", () => {
        expect(greatestCommonDivisor(6, 9)).toEqual(3)
        expect(greatestCommonDivisor(6, 8)).toEqual(2)
        expect(greatestCommonDivisor(6, 6)).toEqual(6)
    })

    it("works with negative numbers", () => {
        expect(greatestCommonDivisor(-10, 5)).toEqual(5)
        expect(greatestCommonDivisor(-5, 10)).toEqual(5)
        expect(greatestCommonDivisor(10, -5)).toEqual(5)
        expect(greatestCommonDivisor(5, -10)).toEqual(5)
        expect(greatestCommonDivisor(-10, -5)).toEqual(5)
        expect(greatestCommonDivisor(-5, -10)).toEqual(5)
    })
})

describe(findGreatestCommonDivisorOfArray, () => {
    it("returns the greatest common divisor of an array of numbers", () => {
        expect(findGreatestCommonDivisorOfArray([6, 9, 12])).toEqual(3)
        expect(findGreatestCommonDivisorOfArray([6, 8, 12])).toEqual(2)
        expect(findGreatestCommonDivisorOfArray([6, 6, 6])).toEqual(6)
        expect(findGreatestCommonDivisorOfArray([15])).toEqual(15)
    })
})

describe(traverseEnrichedBlock, () => {
    const enrichedBlocks: OwidEnrichedGdocBlock[] = [
        {
            type: "prominent-link",
            url: "https://ourworldindata.org",
            parseErrors: [],
        },
        {
            type: "gray-section",
            parseErrors: [],
            items: [
                {
                    type: "text",
                    value: [
                        {
                            spanType: "span-bold",
                            children: [
                                {
                                    spanType: "span-simple-text",
                                    text: "Hello",
                                },
                            ],
                        },
                    ],
                    parseErrors: [],
                },
                {
                    type: "aside",
                    caption: [
                        {
                            spanType: "span-link",
                            url: "https://ourworldindata.org",
                            children: [
                                {
                                    spanType: "span-simple-text",
                                    text: "I am an aside",
                                },
                            ],
                        },
                    ],
                    parseErrors: [],
                },
            ],
        },
        {
            type: "chart",
            url: "https://ourworldindata.org/grapher/population",
            parseErrors: [],
        },
        {
            type: "sticky-left",
            left: [
                {
                    type: "text",
                    value: [
                        {
                            spanType: "span-italic",
                            children: [
                                {
                                    spanType: "span-simple-text",
                                    text: "I am some italic text",
                                },
                            ],
                        },
                    ],
                    parseErrors: [],
                },
                {
                    type: "image",
                    filename: "logo.png",
                    hasOutline: false,
                    size: BlockImageSize.Narrow,
                    parseErrors: [],
                },
            ],
            right: [
                {
                    type: "heading",
                    level: 1,
                    text: [
                        {
                            spanType: "span-simple-text",
                            text: "I am a heading",
                        },
                    ],
                    parseErrors: [],
                },
                {
                    type: "list",
                    items: [
                        {
                            type: "text",
                            value: [
                                {
                                    spanType: "span-simple-text",
                                    text: "I am a list item",
                                },
                                {
                                    spanType: "span-underline",
                                    children: [
                                        {
                                            spanType: "span-simple-text",
                                            text: "I am some underlined text in a list",
                                        },
                                    ],
                                },
                            ],
                            parseErrors: [],
                        },
                    ],
                    parseErrors: [],
                },
            ],
            parseErrors: [],
        },
    ]

    it("Traverses enriched blocks and runs a callback on them all", () => {
        const seen: string[] = []

        enrichedBlocks.forEach((block) => {
            traverseEnrichedBlock(block, (block) => {
                seen.push(block.type)
            })
        })

        expect(seen).toEqual([
            "prominent-link",
            "gray-section",
            "text",
            "aside",
            "chart",
            "sticky-left",
            "text",
            "image",
            "heading",
            "list",
        ])
    })

    it("Traverses enriched blocks and spans and runs a callback on them both if a span callback is given", () => {
        const seen: string[] = []

        enrichedBlocks.forEach((block) => {
            traverseEnrichedBlock(
                block,
                (block) => {
                    seen.push(block.type)
                },
                (span) => {
                    seen.push(span.spanType)
                }
            )
        })

        expect(seen).toEqual([
            "prominent-link",
            "gray-section",
            "text",
            "span-bold",
            "span-simple-text",
            "aside",
            "span-link",
            "span-simple-text",
            "chart",
            "sticky-left",
            "text",
            "span-italic",
            "span-simple-text",
            "image",
            "heading",
            "span-simple-text",
            "list",
            "text",
            "span-simple-text",
            "span-underline",
            "span-simple-text",
        ])
    })
})

describe(cartesian, () => {
    it("returns an empty list when no arrays are provided", () => {
        expect(cartesian([])).toEqual([])
    })

    it("returns individual items if a single array is given", () => {
        expect(cartesian([["a", "b"]])).toEqual([["a"], ["b"]])
    })

    it("returns all possible combinations if multiple arrays are given", () => {
        expect(cartesian([["a", "b"], ["x"]])).toEqual([
            ["a", "x"],
            ["b", "x"],
        ])
        expect(
            cartesian([
                ["a", "b"],
                ["x", "y"],
            ])
        ).toEqual([
            ["a", "x"],
            ["a", "y"],
            ["b", "x"],
            ["b", "y"],
        ])
        expect(
            cartesian([
                ["a", "b"],
                ["x", "y"],
                ["+", "-"],
            ])
        ).toEqual([
            ["a", "x", "+"],
            ["a", "x", "-"],
            ["a", "y", "+"],
            ["a", "y", "-"],
            ["b", "x", "+"],
            ["b", "x", "-"],
            ["b", "y", "+"],
            ["b", "y", "-"],
        ])
    })
})

describe(flattenNonTopicNodes, () => {
    it("Removes sub-areas from the TagGraphRoot", () => {
        const root: TagGraphRoot = {
            children: [
                {
                    children: [
                        {
                            children: [
                                {
                                    children: [],
                                    id: 4,
                                    isTopic: true,
                                    name: "Life Expectancy",
                                    path: [1, 2, 3, 4],
                                    slug: "life-expectancy",
                                    weight: 0,
                                },
                            ],
                            id: 3,
                            isTopic: false,
                            name: "Life & Death",
                            path: [1, 2, 3],
                            slug: null,
                            weight: 0,
                        },
                    ],
                    id: 2,
                    isTopic: false,
                    name: "Health",
                    path: [1, 2],
                    slug: null,
                    weight: 0,
                },
            ],
            id: 1,
            isTopic: false,
            name: "tag-graph-root",
            path: [1],
            slug: null,
            weight: 0,
        }
        const flattened = flattenNonTopicNodes(root)
        expect(flattened.children[0].children[0].slug).toEqual(
            "life-expectancy"
        )
    })

    it("Removes non-area non-topic nodes that don't have children", () => {
        const root: TagGraphRoot = {
            id: 1,
            name: "tag-graph-root",
            slug: null,
            weight: 0,
            isTopic: false,
            path: [1],
            children: [
                {
                    id: 2,
                    name: "Health",
                    slug: null,
                    weight: 0,
                    isTopic: false,
                    children: [
                        {
                            id: 3,
                            name: "Unused sub-area",
                            slug: null,
                            weight: 0,
                            isTopic: false,
                            children: [],
                            path: [1, 2, 3],
                        },
                    ],
                    path: [1, 2],
                },
            ],
        }
        const flattened = flattenNonTopicNodes(root)
        expect(flattened.children[0].children.length).toEqual(0)
    })
})

describe(formatInlineList, () => {
    it("returns an empty string when no items are given", () => {
        expect(formatInlineList([])).toEqual("")
    })

    it("returns a single item as a string", () => {
        expect(formatInlineList(["a"])).toEqual("a")
    })

    it("formats two items correctly", () => {
        expect(formatInlineList(["a", "b"])).toEqual("a and b")
    })

    it("formats three items correctly using 'and'", () => {
        expect(formatInlineList(["a", "b", "c"])).toEqual("a, b and c")
    })

    it("formats four items correctly using 'or'", () => {
        expect(formatInlineList(["a", "b", "c", "d"], "or")).toEqual(
            "a, b, c or d"
        )
    })
})

describe(imemo, () => {
    class IMemoTest {
        randomValueRaw(): number {
            return Math.random()
        }
        @imemo get randomValue(): number {
            return this.randomValueRaw()
        }
    }

    it("memoizes a function", () => {
        const classInstance = new IMemoTest()
        const spy = vi.spyOn(classInstance, "randomValueRaw")
        const firstValue = classInstance.randomValue
        const secondValue = classInstance.randomValue

        expect(firstValue).toEqual(secondValue)
        expect(firstValue).toBeTypeOf("number")
        expect(spy).toHaveBeenCalledOnce()
    })
})
