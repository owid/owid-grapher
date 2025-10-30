import { describe, expect, it } from "vitest"
import { instantiateProfile, getEntitiesForProfile } from "./profiles.js"
import {
    getCountryByName,
    articulateEntity,
    type Country,
    countries,
    checkIsCountry,
    regions,
    getRegionByNameOrVariantName,
} from "./regions.js"
import {
    OwidGdocType,
    type OwidGdocProfileContent,
    type OwidGdocProfileInterface,
    OwidGdocPublicationContext,
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

const buildProfile = (scope?: string): OwidGdocProfileInterface => ({
    id: "profile-test",
    slug: "profile-test-slug",
    content: {
        ...buildProfileTemplate(),
        scope: scope ?? "",
    },
    contentMd5: "md5",
    published: true,
    createdAt: new Date("2025-10-30T00:00:00Z"),
    updatedAt: new Date("2025-10-30T00:00:00Z"),
    publishedAt: new Date("2025-10-30T00:00:00Z"),
    revisionId: "rev-1",
    publicationContext: OwidGdocPublicationContext.listed,
    manualBreadcrumbs: null,
    markdown: null,
})

describe("instantiateProfile", () => {
    it("replaces placeholders with articulated entity name and code", () => {
        const country = getCountryByName("United States") as Country
        const template = buildProfileTemplate()

        const instantiated = instantiateProfile(template, country)

        expect(instantiated).not.toBe(template)
        expect(instantiated.title).toEqual(
            `${articulateEntity(country.name)} Energy Profile`
        )
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
})

describe("getEntitiesForProfile", () => {
    it("returns an empty list when the scope is blank", () => {
        const profile = buildProfile("")

        const entities = getEntitiesForProfile(profile)

        expect(entities).toEqual([])
    })

    it("returns specific countries when they're the only ones specified", () => {
        const profile = buildProfile("United States, Canada")

        const entities = getEntitiesForProfile(profile)

        expect(entities).toHaveLength(2)
        expect(entities).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: "USA", name: "United States" }),
                expect.objectContaining({ code: "CAN", name: "Canada" }),
            ])
        )
    })

    it("returns all countries when scope is 'countries'", () => {
        const profile = buildProfile("countries")

        const entities = getEntitiesForProfile(profile)

        expect(entities).toHaveLength(countries.length)
        expect(entities).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: "USA", name: "United States" }),
                expect.objectContaining({ code: "FRA", name: "France" }),
            ])
        )
    })

    it("returns all non-country regions when scope is 'regions'", () => {
        const profile = buildProfile("regions")
        const nonCountryRegions = regions.filter(
            (region) => !checkIsCountry(region)
        )

        const entities = getEntitiesForProfile(profile)

        expect(entities).toHaveLength(nonCountryRegions.length)
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
        const profile = buildProfile("United States, USA")

        const entities = getEntitiesForProfile(profile)

        expect(entities).toHaveLength(1)
        expect(entities[0]).toMatchObject({
            code: "USA",
            name: "United States",
        })
    })

    it("includes both countries and regions when scope is 'all'", () => {
        const profile = buildProfile("all")
        const nonCountryRegions = regions.filter(
            (region) => !checkIsCountry(region)
        )

        const entities = getEntitiesForProfile(profile)

        expect(entities).toHaveLength(
            countries.length + nonCountryRegions.length
        )
        expect(entities).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: "USA" }),
                expect.objectContaining({ code: "OWID_EUR" }),
            ])
        )
    })

    it("resolves entities with trailing parentheticals", () => {
        const profile = buildProfile("China (People's Republic of)")

        const entities = getEntitiesForProfile(profile)

        expect(entities).toHaveLength(1)
        expect(entities[0]).toMatchObject({
            code: "CHN",
            name: "China",
        })
    })
})
