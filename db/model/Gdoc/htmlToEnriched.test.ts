import { expect, it } from "vitest"

import { cheerioElementsToArchieML } from "./htmlToEnriched.js"
import * as cheerio from "cheerio"

it("parses a Wordpress paragraph within the content", () => {
    // The wrapping <div> is there to help simulate paragraphs within the
    // content (as opposed to paragraphs appearing as the first element). This
    // allows us to get all nodes, including the first wp:paragraph comment
    // node, which would be skipped by cheerio.load() otherwise (cheerio.load
    // ignores comments if they are the first node in the document).
    const html = `
    <div>
        <!-- wp:paragraph -->
        <p>or sit amet, consectetur adipiscing elit</p>
        <!-- /wp:paragraph -->
    </div>
    `
    const $: CheerioStatic = cheerio.load(html)
    // The first element of the <div> contents is a new line, so we skip it
    const bodyContents = $("body > div").contents().toArray().slice(1)

    const context = {
        $,
        shouldParseWpComponents: true,
        htmlTagCounts: {},
        wpTagCounts: {},
        isEntry: false,
    }

    const parsedResult = cheerioElementsToArchieML(bodyContents, context)

    expect(parsedResult.content).toEqual([
        {
            type: "text",
            value: [
                {
                    spanType: "span-simple-text",
                    text: "or sit amet, consectetur adipiscing elit",
                },
            ],
            parseErrors: [],
        },
    ])
})

it("parses a Wordpress paragraph as the first element", () => {
    // In this case, the first element is a wp:paragraph comment node, which
    // gets skipped by cheerio.load(). Given that we would clean up that opening
    // wp:paragraph either way (cf. above), we are effectively getting for both
    // first child paragraphs or in-content paragraphs the same output.
    const html = `
        <!-- wp:paragraph -->
        <p>or sit amet, consectetur adipiscing elit</p>
        <!-- /wp:paragraph -->
    `
    const $: CheerioStatic = cheerio.load(html)

    const bodyContents = $("body").contents().toArray()

    const parsedResult = cheerioElementsToArchieML(bodyContents, {
        $,
        shouldParseWpComponents: true,
        wpTagCounts: {},
        htmlTagCounts: {},
        isEntry: false,
    })

    expect(parsedResult.content).toEqual([
        {
            type: "text",
            value: [
                {
                    spanType: "span-simple-text",
                    text: "or sit amet, consectetur adipiscing elit",
                },
            ],
            parseErrors: [],
        },
    ])
})
