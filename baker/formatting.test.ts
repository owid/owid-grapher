#! /usr/bin/env jest

import {
    parseFormattingOptions,
    parseKeyValueArgs,
} from "../serverUtils/wordpressUtils.js"

it("parses formatting options", () => {
    const formattingOptions =
        "subnavId:coronavirus isTrue isAlsoTrue:true isFalse:false"
    expect(parseFormattingOptions(formattingOptions)).toStrictEqual({
        subnavId: "coronavirus",
        isTrue: true,
        isAlsoTrue: true,
        isFalse: false,
    })
})

it("parses LastUpdated options", () => {
    const lastUpdatedOptions =
        "timestampUrl:https://covid.ourworldindata.org/data/internal/timestamp/owid-covid-data-last-updated-timestamp-root.txt"
    expect(parseKeyValueArgs(lastUpdatedOptions)).toStrictEqual({
        timestampUrl:
            "https://covid.ourworldindata.org/data/internal/timestamp/owid-covid-data-last-updated-timestamp-root.txt",
    })
})
