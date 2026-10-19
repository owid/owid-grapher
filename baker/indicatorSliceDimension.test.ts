import { expect, it, describe } from "vitest"
import {
    classifySliceFromDimensions,
    classifySliceFromTitles,
    shouldHideCollapsedIndicatorList,
    IndicatorSliceDims,
} from "./indicatorSliceDimension.js"
import { IndicatorPaneCollapse } from "./collapseIndicatorPanes.js"

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

const collapse = (
    titles: string[],
    over: Partial<IndicatorPaneCollapse> & {
        shorts?: string[]
        notes?: string[]
    } = {}
): IndicatorPaneCollapse => ({
    list: titles.map((title, i) => ({
        title,
        short: over.shorts?.[i],
        note: over.notes?.[i],
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
                AGES.map((age) => dim({ sex: "all", age, variant: "estimates" }))
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
        expect(classifySliceFromTitles(["2020s", "2010s", "2000s", "1990s"])).toBe(
            "year"
        )
        expect(classifySliceFromTitles(["2022", "2024", "2026"])).toBeUndefined()
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
            classifySliceFromTitles(["HPV type 16", "HPV type 18", "HPV type 33", "HPV type 51"])
        ).toBeUndefined()
        expect(
            classifySliceFromTitles(["Category 1", "Category 2", "Category 3", "Category 4"])
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

describe(shouldHideCollapsedIndicatorList, () => {
    const ageTitles = ["Ages 0-4", "Ages 5-9", "Ages 10-14", "Ages 15-19", "Ages 20-24"]
    const ageDims = AGES.map((age) => dim({ age }))

    it("hides the list for an age slice, by metadata or by titles", () => {
        expect(shouldHideCollapsedIndicatorList(collapse(ageTitles), ageDims)).toEqual({
            hide: true,
            sliceClass: "age",
        })
        expect(
            shouldHideCollapsedIndicatorList(collapse(ageTitles), ageDims.map(() => undefined))
        ).toEqual({ hide: true, sliceClass: "age" })
    })
    it("needs at least four entries", () => {
        expect(
            shouldHideCollapsedIndicatorList(collapse(ageTitles.slice(0, 3)), ageDims.slice(0, 3))
                .hide
        ).toBe(false)
    })
    it("keeps the list when units, title variants or notes vary", () => {
        expect(
            shouldHideCollapsedIndicatorList(collapse(ageTitles, { suppressUnit: true }), ageDims)
                .hide
        ).toBe(false)
        expect(
            shouldHideCollapsedIndicatorList(
                collapse(ageTitles, { suppressTitleVariant: true }),
                ageDims
            ).hide
        ).toBe(false)
        expect(
            shouldHideCollapsedIndicatorList(
                collapse(ageTitles, { notes: [undefined, "Excludes stillbirths."] as string[] }),
                ageDims
            ).hide
        ).toBe(false)
    })
    it("lets short descriptions differ only in the same slot", () => {
        const slotShorts = AGES.map((a) => `Deaths among people aged ${a} years.`)
        expect(
            shouldHideCollapsedIndicatorList(collapse(ageTitles, { shorts: slotShorts }), ageDims)
                .hide
        ).toBe(true)
        const realShorts = [...slotShorts.slice(0, 4), "Deaths among everyone, age-standardized."]
        expect(
            shouldHideCollapsedIndicatorList(collapse(ageTitles, { shorts: realShorts }), ageDims)
                .hide
        ).toBe(false)
    })
    it("keeps the list for an informative dimension", () => {
        const causes = ["Malaria", "Measles", "Meningitis", "Tetanus"]
        expect(
            shouldHideCollapsedIndicatorList(
                collapse(causes.map((c) => `Deaths from ${c.toLowerCase()}`)),
                causes.map((cause) => dim({ cause }))
            ).hide
        ).toBe(false)
    })
})
