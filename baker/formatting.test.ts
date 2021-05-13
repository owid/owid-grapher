#! /usr/bin/env jest

import { parseFormattingOptions } from "./formatting"

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
