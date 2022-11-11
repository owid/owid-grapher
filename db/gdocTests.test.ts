#! /usr/bin/env yarn jest

import { RawBlockHeader } from "@ourworldindata/utils/dist/index.js"
import { stringToArchieML } from "./gdocToArchieml.js"
import { owidRawArticleBlockToArchieMLString } from "./gdocUtils.js"

function getArchieMLDocWithContent(content: string): string {
    return `title: Writing OWID Articles With Google Docs
subtitle: This article documents how to use and configure the various built in features of our template system
byline: Matthew Conlen
dateline: June 30, 2022
template: centered


[+body]
${content}
[]
`
}

describe("gdoc parsing works", () => {
    it("can parse an aside block", () => {
        const doc = getArchieMLDocWithContent(
            `
{.aside}
caption: Lorem ipsum dolor sit amet, consectetur adipiscing elit.
{}`
        )
        const article = stringToArchieML(doc)
        expect(article?.body?.length).toBe(1)
        expect(article?.body && article?.body[0]).toEqual({
            type: "aside",
            caption: [
                {
                    spanType: "span-simple-text",
                    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
                },
            ],
            position: undefined,
            parseErrors: [],
        })
    })

    it("can parse a header block", () => {
        const archieMLString = `{.header}
text: Lorem ipsum dolor sit amet, consectetur adipiscing elit.
level: 2
{}`
        const doc = getArchieMLDocWithContent(archieMLString)
        const article = stringToArchieML(doc)
        expect(article?.body?.length).toBe(1)
        const expectedEnrichedBlock = {
            type: "header",
            text: {
                spanType: "span-simple-text",
                text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
            },
            level: 2,
            parseErrors: [],
        }
        expect(article?.body && article?.body[0]).toEqual(expectedEnrichedBlock)

        const expectedRawBlock: RawBlockHeader = {
            type: "header",
            value: {
                text: expectedEnrichedBlock.text.text,
                level: expectedEnrichedBlock.level.toString(),
            },
        }

        const serializedRawBlock =
            owidRawArticleBlockToArchieMLString(expectedRawBlock)
        expect(serializedRawBlock).toEqual(archieMLString)
    })
})
