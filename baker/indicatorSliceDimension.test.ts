import { expect, it, describe } from "vitest"
import {
    classifySliceFromDimensions,
    classifySliceFromTitles,
    shouldHideStitchedIndicatorList,
    IndicatorSliceDims,
} from "./indicatorSliceDimension.js"
import { IndicatorPaneStitch } from "./stitchIndicatorPanes.js"

const dim = (
    filters: Record<string, string>,
    over: Partial<IndicatorSliceDims> = {}
): IndicatorSliceDims => ({
    originalShortName: "deaths",
    tablePath: "grapher/un/2024-07-12/un_wpp/deaths",
    filters: Object.entries(filters).map(([name, value]) => ({ name, value })),
    ...over,
})

const AGES = ["0-4", "5-9", "10-14", "15-19", "20-24"]

const stitch = (
    titles: string[],
    over: Partial<IndicatorPaneStitch> & {
        shorts?: string[]
        notes?: string[]
        units?: string[]
    } = {}
): IndicatorPaneStitch => ({
    list: titles.map((title, i) => ({
        title,
        short: over.shorts?.[i],
        note: over.notes?.[i],
        unit: over.units?.[i],
    })),
    dateRange: "1950-2023",
    lastUpdated: "2024-07-12",
    suppressDescriptionShort: !!over.shorts,
    suppressUnit: false,
    suppressDescriptionKey: false,
    suppressTitleVariant: false,
    suppressDescriptionFromProducer: false,
    ...over,
})

describe(classifySliceFromDimensions, () => {
    it("detects one measure sliced by age", () => {
        expect(
            classifySliceFromDimensions(
                AGES.map((age) =>
                    dim({ sex: "all", age, variant: "estimates" })
                )
            )
        ).toBe("age")
    })
    it("maps the dataset-specific dimension names", () => {
        expect(
            classifySliceFromDimensions(
                AGES.map((a) => dim({ agegroup_code: a, sex_code: "both" }))
            )
        ).toBe("age")
        expect(
            classifySliceFromDimensions([
                dim({ gender: "women" }),
                dim({ gender: "men" }),
            ])
        ).toBe("sex")
    })
    it("refuses informative dimensions, two varying dimensions, different base columns or tables, and missing metadata", () => {
        expect(
            classifySliceFromDimensions([
                dim({ cause: "Malaria" }),
                dim({ cause: "Measles" }),
            ])
        ).toBeUndefined()
        expect(
            classifySliceFromDimensions([
                dim({ age: "0-4", sex: "male" }),
                dim({ age: "5-9", sex: "female" }),
            ])
        ).toBeUndefined()
        expect(
            classifySliceFromDimensions([
                dim({ age: "0-4" }),
                dim({ age: "5-9" }, { originalShortName: "births" }),
            ])
        ).toBeUndefined()
        expect(
            classifySliceFromDimensions([
                dim({ age: "0-4" }),
                dim({ age: "5-9" }, { tablePath: "grapher/other/t" }),
            ])
        ).toBeUndefined()
        expect(
            classifySliceFromDimensions([dim({ age: "0-4" }), undefined])
        ).toBeUndefined()
    })
    it("counts a filter missing from some indicators as varying", () => {
        expect(
            classifySliceFromDimensions([
                dim({ age: "0-4", sex: "both" }),
                dim({ age: "5-9", sex: "both" }),
                dim({ age: "10-14", sex: "both" }),
                dim({ age: "15-19" }),
            ])
        ).toBeUndefined()
    })
    it("keeps the list when an age-standardized series sits among the brackets", () => {
        expect(
            classifySliceFromDimensions(
                [...AGES, "Age-standardized"].map((age) => dim({ age }))
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

describe(shouldHideStitchedIndicatorList, () => {
    const ageTitles = [
        "Ages 0-4",
        "Ages 5-9",
        "Ages 10-14",
        "Ages 15-19",
        "Ages 20-24",
    ]
    const ageDims = AGES.map((age) => dim({ age }))
    const ageShorts = AGES.map((a) => `Deaths among people aged ${a} years.`)

    it("always hides a list of titles alone", () => {
        expect(
            shouldHideStitchedIndicatorList(stitch(["Coal", "Gas", "Oil"]), [
                undefined,
                undefined,
                undefined,
            ])
        ).toEqual({ hide: true })
    })

    it("hides the list for an age slice, by metadata or by titles", () => {
        expect(
            shouldHideStitchedIndicatorList(
                stitch(ageTitles, { shorts: ageShorts }),
                ageDims
            )
        ).toEqual({
            hide: true,
            sliceClass: "age",
        })
        expect(
            shouldHideStitchedIndicatorList(
                stitch(ageTitles, { shorts: ageShorts }),
                ageDims.map(() => undefined)
            )
        ).toEqual({ hide: true, sliceClass: "age" })
    })
    it("hides short sex and age lists too", () => {
        expect(
            shouldHideStitchedIndicatorList(
                stitch(ageTitles.slice(0, 2)),
                ageDims.slice(0, 2)
            ).hide
        ).toBe(true)
        expect(
            shouldHideStitchedIndicatorList(stitch(["Men", "Women"]), [
                undefined,
                undefined,
            ]).hide
        ).toBe(true)
    })
    it("keeps the list when units, title variants or notes vary", () => {
        expect(
            shouldHideStitchedIndicatorList(
                stitch(ageTitles, {
                    suppressUnit: true,
                    units: ["deaths", "deaths", "deaths", "births", "births"],
                }),
                ageDims
            ).hide
        ).toBe(false)
        expect(
            shouldHideStitchedIndicatorList(
                stitch(ageTitles, {
                    suppressTitleVariant: true,
                    shorts: ageShorts,
                }),
                ageDims
            ).hide
        ).toBe(false)
        expect(
            shouldHideStitchedIndicatorList(
                stitch(ageTitles, {
                    notes: [undefined, "Excludes stillbirths."] as string[],
                }),
                ageDims
            ).hide
        ).toBe(false)
    })
    it("lets short descriptions differ only in the same slot", () => {
        const slotShorts = AGES.map(
            (a) => `Deaths among people aged ${a} years.`
        )
        expect(
            shouldHideStitchedIndicatorList(
                stitch(ageTitles, { shorts: slotShorts }),
                ageDims
            ).hide
        ).toBe(true)
        const realShorts = [
            ...slotShorts.slice(0, 4),
            "Deaths among everyone, age-standardized.",
        ]
        expect(
            shouldHideStitchedIndicatorList(
                stitch(ageTitles, { shorts: realShorts }),
                ageDims
            ).hide
        ).toBe(false)
    })
    it("keeps the list for an informative dimension", () => {
        const causes = ["Malaria", "Measles", "Meningitis", "Tetanus"]
        expect(
            shouldHideStitchedIndicatorList(
                stitch(
                    causes.map((c) => `Deaths from ${c.toLowerCase()}`),
                    { shorts: causes.map((c) => `Estimated deaths from ${c}.`) }
                ),
                causes.map((cause) => dim({ cause }))
            ).hide
        ).toBe(false)
    })
})
