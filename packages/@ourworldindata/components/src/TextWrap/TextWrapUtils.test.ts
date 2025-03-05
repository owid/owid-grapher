import { expect, it } from "vitest"

import { joinFragments, splitIntoFragments } from "./TextWrapUtils"

it("splits text correctly into fragments", () => {
    expect(splitIntoFragments("")).toEqual([])
    expect(splitIntoFragments("word")).toEqual([
        { text: "word", separator: "" },
    ])
    expect(splitIntoFragments("an example line")).toEqual([
        { text: "an", separator: " " },
        { text: "example", separator: " " },
        { text: "line", separator: "" },
    ])
    expect(splitIntoFragments("high-income countries")).toEqual([
        { text: "high-income", separator: " " },
        { text: "countries", separator: "" },
    ])
    expect(splitIntoFragments("high-income countries", [" ", "-"])).toEqual([
        { text: "high", separator: "-" },
        { text: "income", separator: " " },
        { text: "countries", separator: "" },
    ])
})

it("splits and joins text correctly into fragments", () => {
    const examples = [
        "",
        "word",
        "an example line",
        "an example    spaced   out text",
        "an example-with-hyphens",
        "an example - with - a - differennt - kind-of - hyphen",
        "hyphen at the end -",
        "a mixed-bag - ok",
    ]
    for (const text of examples) {
        expect(joinFragments(splitIntoFragments(text))).toEqual(text)
        expect(joinFragments(splitIntoFragments(text, [" ", "-"]))).toEqual(
            text
        )
    }
})
