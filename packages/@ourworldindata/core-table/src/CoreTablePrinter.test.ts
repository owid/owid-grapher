import { expect, it, describe } from "vitest"

import { toAlignedTextTable, toMarkdownTable } from "./CoreTablePrinters.js"
import { parseDelimited } from "./CoreTableUtils.js"

const input = `name,score,color
bob,12,red
mike,321,blue
al,1214,green`
const rows = parseDelimited(input)

it("to aligned table", () => {
    const result = toAlignedTextTable(Object.keys(rows[0]), rows, {
        alignRight: false,
        maxCharactersPerColumn: 100,
    })
    expect(result).toEqual(
        // using \n here because we have trailing whitespace in each line, and prettier would remove it
        `name score color\nbob  12    red  \nmike 321   blue \nal   1214  green`
    )
})

it("to markdown table", () => {
    const result = toMarkdownTable(Object.keys(rows[0]), rows)
    expect(result).toEqual(`|name|score|color|
|-|-|-|
|bob|12|red|
|mike|321|blue|
|al|1214|green|`)
})
