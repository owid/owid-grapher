#! /usr/bin/env jest

import { EntityUrlBuilder, ENTITY_V2_DELIMITER } from "./EntityUrlBuilder"

const encodeTests = [
    {
        entities: ["USA", "GB"],
        queryParam: { _original: "USA~GB", decoded: "USA~GB" },
    },
    {
        entities: ["YouTube", "Google+"],
        queryParam: {
            _original: "YouTube~Google%2B",
            decoded: "YouTube~Google+",
        },
    },
    {
        entities: [
            "Bogebakken (Denmark); 4300 - 3800 BCE",
            "British Columbia (30 sites); 3500 BCE - 1674 CE",
            "Brittany; 6000 BCE",
        ],
        queryParam: {
            _original:
                "Bogebakken%20(Denmark)%3B%204300%20-%203800%20BCE~British%20Columbia%20(30%20sites)%3B%203500%20BCE%20-%201674%20CE~Brittany%3B%206000%20BCE",
            decoded:
                "Bogebakken (Denmark); 4300 - 3800 BCE~British Columbia (30 sites); 3500 BCE - 1674 CE~Brittany; 6000 BCE",
        },
    },
    {
        entities: ["British Columbia (30 sites); 3500 BCE - 1674 CE"],
        queryParam: {
            _original:
                "~British%20Columbia%20(30%20sites)%3B%203500%20BCE%20-%201674%20CE",
            decoded: "~British Columbia (30 sites); 3500 BCE - 1674 CE",
        },
    },
    {
        entities: ["Caribbean small states"],
        queryParam: {
            _original: "~Caribbean%20small%20states",
            decoded: "~Caribbean small states",
        },
    },
    {
        entities: ["North America"],
        queryParam: {
            _original: "~North America",
            decoded: "~North America",
        },
    },
    {
        entities: [],
        queryParam: {
            _original: "",
            decoded: "",
        },
    },
    {
        entities: [
            "Men and Women Ages 65+",
            "Australia & New Zealand + (Total)",
        ],
        queryParam: {
            _original:
                "Men%20and%20Women%20Ages%2065%2B~Australia%20%26%20New%20Zealand%20%2B%20(Total)",
            decoded: "Men and Women Ages 65+~Australia & New Zealand + (Total)",
        },
    },
]

encodeTests.forEach((testCase) => {
    it(`correctly encodes url strings`, () => {
        expect(
            EntityUrlBuilder.entityNamesToQueryParam(testCase.entities)
        ).toEqual(testCase.queryParam.decoded)
    })

    it(`correctly decodes url strings`, () => {
        expect(
            EntityUrlBuilder.queryParamToEntityNames(
                testCase.queryParam._original
            )
        ).toEqual(testCase.entities)
    })
})

describe("legacyLinks", () => {
    const legacyLinks = [
        {
            entities: ["North America", "DOM"],
            queryParam: {
                _original: "North%20America+DOM",
                decoded: "North America DOM",
            },
        },
        {
            entities: ["USA", "GB"],
            queryParam: { _original: "USA+GB", decoded: "USA GB" },
        },
        {
            entities: ["YouTube", "Google+"],
            queryParam: {
                _original: "YouTube+Google%2B",
                decoded: "YouTube Google ",
            },
        },
    ]

    legacyLinks.forEach((testCase) => {
        it(`correctly decodes legacy url strings`, () => {
            expect(
                EntityUrlBuilder.queryParamToEntityNames(
                    testCase.queryParam._original
                )
            ).toEqual(testCase.entities)
        })
    })
})

describe("facebook", () => {
    const facebookLinks = [
        {
            entities: ["Caribbean small states"],
            queryParam: {
                _original: "Caribbean+small+states~",
                decoded: "Carribean small states~",
            },
        },
    ]

    facebookLinks.forEach((testCase) => {
        it(`correctly decodes Facebook altered links`, () => {
            expect(
                EntityUrlBuilder.queryParamToEntityNames(
                    testCase.queryParam._original
                )
            ).toEqual(testCase.entities)
        })
    })
})

describe("it can handle legacy urls with dimension in selection key", () => {
    const queryStr = [
        "United States",
        "USA",
        "GBR-0",
        "1980-1989",
        "NotFound",
    ].join(ENTITY_V2_DELIMITER)

    const results = EntityUrlBuilder.migrateLegacyCountryParam(
        encodeURIComponent(queryStr)
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
