#! /usr/bin/env jest

import { Url } from "../../clientUtils/urls/Url"
import {
    ENTITY_V2_DELIMITER,
    getSelectedEntityNamesParam,
    setSelectedEntityNamesParam,
} from "./EntityUrlBuilder"

const encodeTests = [
    {
        entities: ["United States", "United Kingdom"],
        inputQueryStr: "?country=USA~GBR",
        outputQueryStr: "?selection=USA~GBR",
    },
    {
        entities: ["YouTube", "Google+"],
        inputQueryStr: "?country=YouTube~Google%2B",
        outputQueryStr: "?selection=YouTube~Google%2B",
    },
    {
        entities: [
            "Bogebakken (Denmark); 4300 - 3800 BCE",
            "British Columbia (30 sites); 3500 BCE - 1674 CE",
            "Brittany; 6000 BCE",
        ],
        inputQueryStr:
            "?country=Bogebakken%20(Denmark)%3B%204300%20-%203800%20BCE~British%20Columbia%20(30%20sites)%3B%203500%20BCE%20-%201674%20CE~Brittany%3B%206000%20BCE",
        outputQueryStr:
            "?selection=Bogebakken+%28Denmark%29%3B+4300+-+3800+BCE~British+Columbia+%2830+sites%29%3B+3500+BCE+-+1674+CE~Brittany%3B+6000+BCE",
    },
    {
        entities: ["British Columbia (30 sites); 3500 BCE - 1674 CE"],
        inputQueryStr:
            "?country=~British%20Columbia%20(30%20sites)%3B%203500%20BCE%20-%201674%20CE",
        outputQueryStr:
            "?selection=~British+Columbia+%2830+sites%29%3B+3500+BCE+-+1674+CE",
    },
    {
        entities: ["Caribbean small states"],
        inputQueryStr: "?country=~Caribbean%20small%20states",
        outputQueryStr: "?selection=~Caribbean+small+states",
    },
    {
        entities: ["North America"],
        inputQueryStr: "?country=~North%20America",
        outputQueryStr: "?selection=~North+America",
    },
    {
        entities: [],
        inputQueryStr: "?country=",
        outputQueryStr: "?selection=",
    },
    {
        entities: [
            "Men and Women Ages 65+",
            "Australia & New Zealand + (Total)",
        ],
        inputQueryStr:
            "?country=Men%20and%20Women%20Ages%2065%2B~Australia%20%26%20New%20Zealand%20%2B%20(Total)",
        outputQueryStr:
            "?selection=Men+and+Women+Ages+65%2B~Australia+%26+New+Zealand+%2B+%28Total%29",
    },
]

encodeTests.forEach((testCase) => {
    it(`correctly encodes url strings`, () => {
        expect(
            setSelectedEntityNamesParam(Url.fromQueryStr(""), testCase.entities)
                .queryStr
        ).toEqual(testCase.outputQueryStr)
    })

    it(`correctly decodes url strings`, () => {
        expect(
            getSelectedEntityNamesParam(
                Url.fromQueryStr(testCase.inputQueryStr)
            )
        ).toEqual(testCase.entities)
    })
})

describe("legacyLinks", () => {
    const legacyLinks = [
        {
            entities: ["North America", "Africa"],
            queryStr: "?country=North%20America+Africa",
        },
        {
            entities: ["United States", "United Kingdom"],
            queryStr: "?country=USA+GBR",
        },
        {
            entities: ["YouTube", "Google+"],
            queryStr: "?country=YouTube+Google%2B",
        },
    ]

    legacyLinks.forEach((testCase) => {
        it(`correctly decodes legacy url strings`, () => {
            expect(
                getSelectedEntityNamesParam(Url.fromQueryStr(testCase.queryStr))
            ).toEqual(testCase.entities)
        })
    })
})

describe("facebook", () => {
    const facebookLinks = [
        {
            entities: ["Caribbean small states"],
            queryStr: "?country=Caribbean+small+states~",
        },
    ]

    facebookLinks.forEach((testCase) => {
        it(`correctly decodes Facebook altered links`, () => {
            expect(
                getSelectedEntityNamesParam(Url.fromQueryStr(testCase.queryStr))
            ).toEqual(testCase.entities)
        })
    })
})

describe("it can handle legacy urls with dimension in selection key", () => {
    const url = Url.fromQueryParams({
        country: [
            "United States",
            "USA",
            "GBR-0",
            "1980-1989",
            "NotFound",
        ].join(ENTITY_V2_DELIMITER),
    })

    const results = getSelectedEntityNamesParam(url)

    expect(results).toEqual([
        "United States",
        "United States",
        "GBR-0",
        "United Kingdom",
        "1980-1989",
        "1980",
        "NotFound",
    ])
})
