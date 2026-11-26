import { expect, it, describe } from "vitest"
import {
    StitchedIndicator,
    VariableSliceDimensions,
} from "@ourworldindata/types"
import {
    classifySliceFromDimensions,
    classifySliceFromTitles,
    shouldShowIndicatorList,
} from "./stitchedIndicatorList.js"

const sliceDimensions = (
    filters: Record<string, string>,
    overrides: Partial<VariableSliceDimensions> = {}
): VariableSliceDimensions => ({
    originalShortName: "deaths",
    tablePath: "grapher/un/2024-07-12/un_wpp/deaths",
    filters: Object.entries(filters).map(([name, value]) => ({ name, value })),
    ...overrides,
})

const AGES = ["0-4", "5-9", "10-14", "15-19", "20-24"]

describe(classifySliceFromDimensions, () => {
    it("detects one measure sliced by age", () => {
        expect(
            classifySliceFromDimensions(
                AGES.map((age) =>
                    sliceDimensions({ sex: "all", age, variant: "estimates" })
                )
            )
        ).toBe("age")
    })
    it("maps the dataset-specific dimension names", () => {
        expect(
            classifySliceFromDimensions(
                AGES.map((age) =>
                    sliceDimensions({ agegroup_code: age, sex_code: "both" })
                )
            )
        ).toBe("age")
        expect(
            classifySliceFromDimensions([
                sliceDimensions({ gender: "women" }),
                sliceDimensions({ gender: "men" }),
            ])
        ).toBe("sex")
    })
    it.each<[string, (VariableSliceDimensions | undefined)[]]>([
        [
            "differ by something other than age, sex or year",
            [
                sliceDimensions({ cause: "Malaria" }),
                sliceDimensions({ cause: "Measles" }),
            ],
        ],
        [
            "differ in two filters",
            [
                sliceDimensions({ age: "0-4", sex: "male" }),
                sliceDimensions({ age: "5-9", sex: "female" }),
            ],
        ],
        [
            "come from different columns",
            [
                sliceDimensions({ age: "0-4" }),
                sliceDimensions(
                    { age: "5-9" },
                    { originalShortName: "births" }
                ),
            ],
        ],
        [
            "come from different tables",
            [
                sliceDimensions({ age: "0-4" }),
                sliceDimensions(
                    { age: "5-9" },
                    { tablePath: "grapher/other/t" }
                ),
            ],
        ],
        [
            "don't all have slice metadata",
            [sliceDimensions({ age: "0-4" }), undefined],
        ],
    ])("finds no slice when the indicators %s", (_case, dimensions) => {
        expect(classifySliceFromDimensions(dimensions)).toBeUndefined()
    })
    it("counts a filter missing from some indicators as varying", () => {
        expect(
            classifySliceFromDimensions([
                sliceDimensions({ age: "0-4", sex: "both" }),
                sliceDimensions({ age: "5-9", sex: "both" }),
                sliceDimensions({ age: "10-14", sex: "both" }),
                sliceDimensions({ age: "15-19" }),
            ])
        ).toBeUndefined()
    })
    it("keeps the list when an age-standardized series sits among the brackets", () => {
        expect(
            classifySliceFromDimensions(
                [...AGES, "Age-standardized"].map((age) =>
                    sliceDimensions({ age })
                )
            )
        ).toBeUndefined()
    })
})

describe(classifySliceFromTitles, () => {
    it("recognises years and decades (four or more), age brackets and sexes", () => {
        expect(classifySliceFromTitles(["2026", "2025", "2024", "2023"])).toBe(
            "year"
        )
        expect(
            classifySliceFromTitles(["2020s", "2010s", "2000s", "1990s"])
        ).toBe("year")
        expect(
            classifySliceFromTitles(["2022", "2024", "2026"])
        ).toBeUndefined()
        expect(
            classifySliceFromTitles([
                "Deaths, under-5s",
                "Deaths, 5-14 years old",
                "Deaths, 15-49 years old",
                "Deaths, 70+ years old",
            ])
        ).toBe("age")
        expect(classifySliceFromTitles(["Men", "Women"])).toBe("sex")
    })
    it("never fires on bare numbers or digit ranges without an age word", () => {
        expect(
            classifySliceFromTitles([
                "HPV type 16",
                "HPV type 18",
                "HPV type 33",
                "HPV type 51",
            ])
        ).toBeUndefined()
        expect(
            classifySliceFromTitles([
                "Category 1",
                "Category 2",
                "Category 3",
                "Category 4",
            ])
        ).toBeUndefined()
        // hectare brackets
        expect(
            classifySliceFromTitles(["< 1 ha", "1-2 ha", "2-5 ha", "5-10 ha"])
        ).toBeUndefined()
        // exact ages without an age word are ambiguous too
        expect(classifySliceFromTitles(["0", "10", "15", "25"])).toBeUndefined()
    })
    it("refuses when the varying part contains other words", () => {
        expect(
            classifySliceFromTitles([
                "Deaths from malaria",
                "Deaths from measles",
                "Deaths from meningitis",
                "Deaths from tetanus",
            ])
        ).toBeUndefined()
        expect(
            classifySliceFromTitles([
                "Closed autocracies",
                "Democracies aged 1-18 years",
                "Democracies aged 19-30 years",
                "Democracies aged 31-60 years",
            ])
        ).toBeUndefined()
    })
})

describe(shouldShowIndicatorList, () => {
    const noSliceMetadata = AGES.map(() => undefined)
    const ageSliceMetadata = AGES.map((age) => sliceDimensions({ age }))
    const ageIndicators: StitchedIndicator[] = AGES.map((age) => ({
        title: `Ages ${age}`,
        descriptionShort: `Deaths among people aged ${age} years.`,
    }))

    it("hides a list of titles alone", () => {
        expect(
            shouldShowIndicatorList(
                [{ title: "Coal" }, { title: "Gas" }, { title: "Oil" }],
                [undefined, undefined, undefined]
            )
        ).toBe(false)
    })

    it("hides the list of an age slice, known from its slice metadata", () => {
        expect(shouldShowIndicatorList(ageIndicators, ageSliceMetadata)).toBe(
            false
        )
    })

    it("hides the list of an age slice, known from its titles", () => {
        expect(shouldShowIndicatorList(ageIndicators, noSliceMetadata)).toBe(
            false
        )
    })

    it("hides the list of a slice of two", () => {
        expect(
            shouldShowIndicatorList(
                [
                    { title: "Men", descriptionShort: "Deaths among men." },
                    { title: "Women", descriptionShort: "Deaths among women." },
                ],
                [undefined, undefined]
            )
        ).toBe(false)
    })

    it.each<[string, Partial<StitchedIndicator>]>([
        ["unit", { unit: "births" }],
        ["'What you should know'", { descriptionKey: "Excludes stillbirths." }],
        ["title variant", { titleVariant: "projections" }],
    ])("shows the list of a slice when a %s differs", (_field, difference) => {
        const [first, ...rest] = ageIndicators
        expect(
            shouldShowIndicatorList(
                [{ ...first, ...difference }, ...rest],
                ageSliceMetadata
            )
        ).toBe(true)
    })

    it("shows the list of a slice when a description says more than the slice", () => {
        const [first, ...rest] = ageIndicators
        expect(
            shouldShowIndicatorList(
                [
                    {
                        ...first,
                        descriptionShort:
                            "Deaths among everyone, age-standardized.",
                    },
                    ...rest,
                ],
                ageSliceMetadata
            )
        ).toBe(true)
    })

    it("shows the list of indicators that aren't a slice by age, sex or year", () => {
        const causes = ["Malaria", "Measles", "Meningitis", "Tetanus"]
        expect(
            shouldShowIndicatorList(
                causes.map((cause) => ({
                    title: `Deaths from ${cause.toLowerCase()}`,
                    descriptionShort: `Estimated deaths from ${cause}.`,
                })),
                causes.map((cause) => sliceDimensions({ cause }))
            )
        ).toBe(true)
    })
})
