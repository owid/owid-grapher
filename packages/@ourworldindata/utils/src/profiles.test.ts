import { describe, expect, it } from "vitest"
import {
    instantiateProfile,
    getEntitiesForProfile,
    checkShouldConditionalSectionRender,
    validateConditionalSectionLists,
} from "./profiles.js"
import {
    getCountryByName,
    articulateEntity,
    type Country,
    countries,
    regions,
    getRegionByNameOrVariantName,
} from "./regions.js"
import {
    OwidGdocType,
    type OwidGdocProfileContent,
    BlockSize,
} from "@ourworldindata/types"

const buildProfileTemplate = (): OwidGdocProfileContent => ({
    type: OwidGdocType.Profile,
    title: "$entityName Energy Profile",
    authors: ["Test Author"],
    scope: "countries",
    excerpt: "Insights about $entityName.",
    subtitle: "$entityName overview",
    body: [
        {
            type: "text",
            value: [
                {
                    spanType: "span-simple-text",
                    text: "$entityName consumes energy.",
                },
            ],
            parseErrors: [],
        },
        {
            type: "chart",
            url: "https://ourworldindata.org/grapher/energy-consumption?tab=chart&stackMode=absolute&region=$entityCode",
            size: BlockSize.Wide,
            parseErrors: [],
        },
    ],
    refs: {
        errors: [],
        definitions: {
            a: {
                id: "a",
                index: 0,
                content: [
                    {
                        type: "text",
                        value: [
                            {
                                text: "$entityName Health Study ",
                                spanType: "span-simple-text",
                            },
                            {
                                url: "https://doi.org/11.1111/S111?for=$entityCode",
                                children: [
                                    {
                                        text: "https://doi.org/11.1111/S111?for=$entityCode",
                                        spanType: "span-simple-text",
                                    },
                                ],
                                spanType: "span-link",
                            },
                        ],
                        parseErrors: [],
                    },
                ],
                parseErrors: [],
            },
        },
    },
})

describe("instantiateProfile", () => {
    it("replaces placeholders with articulated entity name and code", () => {
        const country = getCountryByName("United States") as Country
        const template = buildProfileTemplate()
        const expectedEntity = articulateEntity(country.name)

        const instantiated = instantiateProfile(template, country)

        expect(instantiated).not.toBe(template)
        expect(instantiated.title).toEqual(`${expectedEntity} Energy Profile`)
        expect(instantiated.excerpt).toEqual(
            `Insights about ${articulateEntity(country.name)}.`
        )
        expect(instantiated.body[0]).toMatchObject({
            value: [
                {
                    spanType: "span-simple-text",
                    text: "the United States consumes energy.",
                },
            ],
        })
        expect(instantiated.body[1]).toMatchObject({
            url: "https://ourworldindata.org/grapher/energy-consumption?tab=chart&stackMode=absolute&region=USA",
        })
        expect(
            (instantiated.refs?.definitions["a"].content[0] as any).value[0]
        ).toMatchObject({
            text: "the United States Health Study ",
        })
        expect(
            (instantiated.refs?.definitions["a"].content[0] as any).value[1]
        ).toMatchObject({
            url: "https://doi.org/11.1111/S111?for=USA",
        })

        // Ensure the template remains unchanged
        expect(template.title).toEqual("$entityName Energy Profile")
    })

    it("returns unarticulated names when no article is defined", () => {
        const country = getCountryByName("France") as Country
        const template = buildProfileTemplate()

        const instantiated = instantiateProfile(template, country)

        expect(instantiated.title).toEqual("France Energy Profile")
    })

    it("does not generate TOC (deferred to instantiateProfileForEntity)", () => {
        const country = getCountryByName("Canada") as Country
        const template: OwidGdocProfileContent = {
            ...buildProfileTemplate(),
            ["sidebar-toc"]: true,
            body: [
                {
                    type: "heading",
                    text: [
                        {
                            spanType: "span-simple-text",
                            text: "How much does $entityName emit?",
                        },
                    ],
                    level: 1,
                    parseErrors: [],
                },
            ],
        }

        const instantiated = instantiateProfile(template, country)

        // TOC generation is now deferred to instantiateProfileForEntity,
        // after data-callout blocks with missing data have been cleared
        expect(instantiated.toc).toBeUndefined()
    })

    it("formats possessives for articulated names", () => {
        const country = getCountryByName("United States") as Country
        const template: OwidGdocProfileContent = {
            ...buildProfileTemplate(),
            title: "$entityName overview",
            excerpt:
                "$entityName is unique. What is $entityName’s life expectancy?",
            body: [
                {
                    type: "text",
                    value: [
                        {
                            spanType: "span-simple-text",
                            text: "$entityName drives growth.\n- $entityName’s innovation sets trends.",
                        },
                    ],
                    parseErrors: [],
                },
            ],
        }

        const instantiated = instantiateProfile(template, country)

        expect(instantiated.title).toEqual("the United States overview")
        expect(instantiated.excerpt).toEqual(
            "the United States is unique. What is the United States’ life expectancy?"
        )
        expect(instantiated.body[0]).toMatchObject({
            value: [
                expect.objectContaining({
                    text: "the United States drives growth.\n- the United States’ innovation sets trends.",
                }),
            ],
        })
    })

    it("supports capitalized replacements via $EntityName tokens", () => {
        const country = getCountryByName("United States") as Country
        const template: OwidGdocProfileContent = {
            ...buildProfileTemplate(),
            title: "$EntityName overview",
            excerpt: "$EntityName leads $entityName’s examples.",
        }

        const instantiated = instantiateProfile(template, country)

        expect(instantiated.title).toEqual("The United States overview")
        expect(instantiated.excerpt).toEqual(
            "The United States leads the United States’ examples."
        )
    })
})

describe("getEntitiesForProfile", () => {
    it("returns an empty list when the scope is blank", () => {
        const entities = getEntitiesForProfile("")

        expect(entities).toEqual([])
    })

    it("returns specific countries when they're the only ones specified", () => {
        const entities = getEntitiesForProfile("United States, Canada")

        expect(entities).toHaveLength(2)
        expect(entities).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: "USA", name: "United States" }),
                expect.objectContaining({ code: "CAN", name: "Canada" }),
            ])
        )
    })

    it("returns all countries when scope is 'countries'", () => {
        const entities = getEntitiesForProfile("countries")

        expect(entities).toHaveLength(countries.length)
        expect(entities).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: "USA", name: "United States" }),
                expect.objectContaining({ code: "FRA", name: "France" }),
            ])
        )
    })

    it("returns continents when scope is 'continents'", () => {
        const continents = regions.filter(
            (region) => region.regionType === "continent"
        )

        const entities = getEntitiesForProfile("continents")

        expect(entities).toHaveLength(continents.length)
        const europe = getRegionByNameOrVariantName("Europe")
        expect(europe).toBeTruthy()
        expect(entities).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    code: europe!.code,
                    name: europe!.name,
                }),
            ])
        )
    })

    it("deduplicates entities referenced by name or code", () => {
        const entities = getEntitiesForProfile("United States, USA")

        expect(entities).toHaveLength(1)
        expect(entities[0]).toMatchObject({
            code: "USA",
            name: "United States",
        })
    })

    it("includes both countries and regions when scope is 'all'", () => {
        const continents = regions.filter(
            (region) => region.regionType === "continent"
        )

        const entities = getEntitiesForProfile("all")

        expect(entities).toHaveLength(countries.length + continents.length)
        expect(entities).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: "USA" }),
                expect.objectContaining({ code: "OWID_EUR" }),
            ])
        )
    })

    it("exclude specific entities when exclude is provided", () => {
        const entities = getEntitiesForProfile(
            "United States, Canada, Mexico",
            "Canada"
        )

        expect(entities).toHaveLength(2)
        expect(entities).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: "USA" }),
                expect.objectContaining({ code: "MEX" }),
            ])
        )
        expect(entities).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ code: "CAN" })])
        )
    })

    it("exclude multiple entities when exclude contains multiple values", () => {
        const entities = getEntitiesForProfile(
            "countries",
            "United States, Canada"
        )

        expect(entities).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: "USA" }),
                expect.objectContaining({ code: "CAN" }),
            ])
        )
        expect(entities.length).toBe(countries.length - 2)
    })

    it("handles exclude with no matching entities gracefully", () => {
        const entities = getEntitiesForProfile(
            "United States, Canada",
            "Narnia"
        )

        expect(entities).toHaveLength(2)
        expect(entities).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: "USA" }),
                expect.objectContaining({ code: "CAN" }),
            ])
        )
    })
})

describe("shouldConditionalSectionRender", () => {
    it("Can tell when an entity should render when only include is specified", () => {
        const shouldRender = checkShouldConditionalSectionRender({
            entity: "Burkina Faso",
            include: ["Burkina Faso"],
            exclude: [],
        })

        expect(shouldRender).toEqual(true)
    })

    it("Can tell when an entity should render when only exclude is specified", () => {
        const shouldRender = checkShouldConditionalSectionRender({
            entity: "Burkina Faso",
            include: [],
            exclude: ["Burkina Faso"],
        })
        expect(shouldRender).toEqual(false)
    })

    it("Should hide when entity doesn't match include list", () => {
        const shouldRender = checkShouldConditionalSectionRender({
            entity: "Canada",
            include: ["Burkina Faso"],
            exclude: [],
        })
        expect(shouldRender).toEqual(false)
    })

    it("Should show when entity doesn't match exclude list", () => {
        const shouldRender = checkShouldConditionalSectionRender({
            entity: "Canada",
            include: [],
            exclude: ["Burkina Faso"],
        })

        expect(shouldRender).toEqual(true)
    })

    it("Matches entity by region membership (continent)", () => {
        const shouldRender = checkShouldConditionalSectionRender({
            entity: "Burkina Faso",
            include: ["Africa"],
            exclude: [],
        })

        expect(shouldRender).toEqual(true)
    })

    it("Matches entity by income group membership", () => {
        const shouldRender = checkShouldConditionalSectionRender({
            entity: "Canada",
            include: ["High-income countries"],
            exclude: [],
        })

        expect(shouldRender).toEqual(true)
    })

    it("Excludes entity by region membership", () => {
        const shouldRender = checkShouldConditionalSectionRender({
            entity: "Canada",
            include: [],
            exclude: ["High-income countries"],
        })
        expect(shouldRender).toEqual(false)
    })

    it("Handles multiple regions in include list", () => {
        const shouldRender = checkShouldConditionalSectionRender({
            entity: "Brazil",
            include: ["Africa", "South America"],
            exclude: [],
        })

        expect(shouldRender).toEqual(true)
    })

    it("Excludes specific country overrides including region (valid overlap)", () => {
        const shouldRender = checkShouldConditionalSectionRender({
            entity: "Canada",
            include: ["North America"],
            exclude: ["Canada"],
        })
        expect(shouldRender).toEqual(false)
    })

    it("Exclude specific country overrides include income group (valid overlap)", () => {
        const shouldRender = checkShouldConditionalSectionRender({
            entity: "Canada",
            include: ["High-income countries"],
            exclude: ["Canada", "United States"],
        })
        expect(shouldRender).toEqual(false)
    })

    it("Shows entity that matches one of multiple include conditions", () => {
        const shouldRender = checkShouldConditionalSectionRender({
            entity: "New Zealand",
            include: ["Australia", "New Zealand", "Fiji"],
            exclude: [],
        })

        expect(shouldRender).toEqual(true)
    })

    it("Entity not in specified region should be hidden", () => {
        const shouldRender = checkShouldConditionalSectionRender({
            entity: "Japan",
            include: ["Africa"],
            exclude: [],
        })
        expect(shouldRender).toEqual(false)
    })

    it("Returns false when the entity cannot be resolved", () => {
        const shouldRender = checkShouldConditionalSectionRender({
            entity: "Atlantis",
            include: ["Canada"],
            exclude: [],
        })
        expect(shouldRender).toEqual(false)
    })
})

describe("validateConditionalSectionLists", () => {
    it("Returns an error when same entity appears in both include and exclude", () => {
        const errors = validateConditionalSectionLists(
            ["Canada", "United States"],
            ["Canada"]
        )
        expect(errors).toHaveLength(1)
    })

    it("Returns an error when include and exclude are specified but include has a country", () => {
        const errors = validateConditionalSectionLists(
            ["Afghanistan"],
            ["Laos"]
        )
        expect(errors).toHaveLength(1)
    })

    it("Returns an error if an exclude isn't relevant given the includes", () => {
        const errors = validateConditionalSectionLists(
            ["Low-income countries"],
            ["United Kingdom"]
        )
        expect(errors).toHaveLength(1)
    })

    it("Returns an error if an invalid region is provided", () => {
        const errors = validateConditionalSectionLists(
            ["not-a-country-or-region"],
            []
        )

        expect(errors).toHaveLength(1)
    })

    it("Returns an error if include and exclude aren't specified", () => {
        const errors = validateConditionalSectionLists([], [])
        expect(errors).toHaveLength(1)
    })
})
