#! /usr/bin/env yarn jest

import { EntityUrlBuilder, ENTITY_V2_DELIMITER } from "./EntityUrlBuilder"

const encodeTests = [
    { entities: ["USA", "GB"], queryString: "USA~GB" },
    {
        entities: ["YouTube", "Google+"],
        queryString: "YouTube~Google%2B",
    },
    {
        entities: [
            "Bogebakken (Denmark); 4300 - 3800 BCE",
            "British Columbia (30 sites); 3500 BCE - 1674 CE",
            "Brittany; 6000 BCE",
        ],
        queryString:
            "Bogebakken%20(Denmark)%3B%204300%20-%203800%20BCE~British%20Columbia%20(30%20sites)%3B%203500%20BCE%20-%201674%20CE~Brittany%3B%206000%20BCE",
    },
    {
        entities: ["British Columbia (30 sites); 3500 BCE - 1674 CE"],
        queryString:
            "~British%20Columbia%20(30%20sites)%3B%203500%20BCE%20-%201674%20CE",
    },
    {
        entities: ["Caribbean small states"],
        queryString: "~Caribbean%20small%20states",
    },
    {
        entities: ["North America"],
        queryString: "~North%20America",
    },
    {
        entities: [],
        queryString: "",
    },
    {
        entities: [
            "Men and Women Ages 65+",
            "Australia & New Zealand + (Total)",
        ],
        queryString:
            "Men%20and%20Women%20Ages%2065%2B~Australia%20%26%20New%20Zealand%20%2B%20(Total)",
    },
]

encodeTests.forEach((testCase) => {
    it(`correctly encodes url strings`, () => {
        expect(
            EntityUrlBuilder.entityNamesToEncodedQueryParam(testCase.entities)
        ).toEqual(testCase.queryString)
    })

    it(`correctly decodes url strings`, () => {
        expect(
            EntityUrlBuilder.queryParamToEntityNames(testCase.queryString)
        ).toEqual(testCase.entities)
    })
})

describe("legacyLinks", () => {
    const legacyLinks = [
        {
            entities: ["North America", "DOM"],
            queryString: "North%20America+DOM",
        },
        { entities: ["USA", "GB"], queryString: "USA+GB" },
        { entities: ["YouTube", "Google+"], queryString: "YouTube+Google%2B" },
    ]

    legacyLinks.forEach((testCase) => {
        it(`correctly decodes legacy url strings`, () => {
            expect(
                EntityUrlBuilder.queryParamToEntityNames(testCase.queryString)
            ).toEqual(testCase.entities)
        })
    })
})

describe("facebook", () => {
    const facebookLinks = [
        {
            entities: ["Caribbean small states"],
            queryString: "Caribbean+small+states~",
        },
    ]

    facebookLinks.forEach((testCase) => {
        it(`correctly decodes Facebook altered links`, () => {
            expect(
                EntityUrlBuilder.queryParamToEntityNames(testCase.queryString)
            ).toEqual(testCase.entities)
        })
    })
})

describe("it can handle legacy urls with dimension in selection key", () => {
    const results = EntityUrlBuilder.migrateLegacyCountryParam(
        ["United States", "USA", "GBR-0", "1980-1989", "NotFound"].join(
            ENTITY_V2_DELIMITER
        )
    )

    expect(results).toEqual(
        [
            "United States",
            "United States",
            "United Kingdom",
            "GBR-0",
            "1980",
            "1980-1989",
            "NotFound",
        ].join(ENTITY_V2_DELIMITER)
    )
})
