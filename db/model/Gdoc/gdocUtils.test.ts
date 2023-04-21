#! /usr/bin/env jest

import {
    EnrichedBlockHeading,
    EnrichedBlockText,
    OwidGdocInterface,
    OwidGdocPublicationContext,
} from "@ourworldindata/utils/dist/owidTypes.js"
import { splitGdocContentUsingHeadingOneTextsAsKeys } from "./gdocUtils.js"

it("splits a datapage gdoc into keyed sections", () => {
    const getHeadingBlock = (text: string): EnrichedBlockHeading => {
        return {
            text: [
                {
                    text,
                    spanType: "span-simple-text",
                },
            ],
            type: "heading",
            level: 1,
            parseErrors: [],
        }
    }

    const getTextBlock = (text: string): EnrichedBlockText => ({
        type: "text",
        value: [
            {
                text,
                spanType: "span-simple-text",
            },
        ],
        parseErrors: [],
    })

    const gdoc: OwidGdocInterface = {
        id: "id",
        slug: "slug",
        published: true,
        createdAt: new Date(),
        publishedAt: new Date(),
        updatedAt: new Date(),
        publicationContext: OwidGdocPublicationContext.listed,
        revisionId: "revisionId",
        content: {
            body: [
                getHeadingBlock("title"),
                getTextBlock("Gini coefficient"),
                getHeadingBlock("keyInfoText"),
                getTextBlock(
                    "The Gini coefficient is a measure of inequality that ranges between 0 and 1, where higher values indicate higher inequality."
                ),
                getTextBlock(
                    "Depending on the country and year, the data relates to either disposable income or consumption per capita, depending on the country and year."
                ),
            ],
        },
    }
    const keyedContentBlocks = splitGdocContentUsingHeadingOneTextsAsKeys(gdoc)
    expect(keyedContentBlocks).toEqual({
        title: gdoc.content.body!.slice(1, 2),
        keyInfoText: gdoc.content.body!.slice(3, 5),
    })
})
