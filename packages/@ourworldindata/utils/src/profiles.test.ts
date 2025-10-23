import { describe, expect, it } from "vitest"
import { instantiateProfile } from "./profiles.js"
import { getCountryByName, articulateEntity, type Country } from "./regions.js"
import {
    OwidGdocType,
    type OwidGdocProfileContent,
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
