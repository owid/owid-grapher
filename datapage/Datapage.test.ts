#! /usr/bin/env jest

import {
    EnrichedBlockHeading,
    EnrichedBlockText,
    OwidGdocInterface,
    OwidGdocPublicationContext,
} from "@ourworldindata/utils"
import { parseGdocContentFromAllowedLevelOneHeadings } from "./Datapage.js"

it("parsed a datapage gdoc into allowed keyed sections", () => {
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
            authors: ["Our World in Data team"],
            body: [
                getHeadingBlock("title"),
                getTextBlock("Gini coefficient"),
                getHeadingBlock("faqs"),
                getTextBlock("Some FAQ content"),
                getHeadingBlock("keyInfoText"),
                getTextBlock(
                    "The Gini coefficient is a measure of inequality that ranges between 0 and 1, where higher values indicate higher inequality."
                ),
                getTextBlock(
                    "Depending on the country and year, the data relates to either disposable income or consumption per capita, depending on the country and year."
                ),
                getHeadingBlock("descriptionFromSource"),
                getTextBlock("The description from source content"),
                getHeadingBlock("sourceDescription1"),
                getTextBlock("Beginning of source description"),
                getTextBlock("End of source description"),
            ],
        },
    }
    const keyedContentBlocks = parseGdocContentFromAllowedLevelOneHeadings(gdoc)
    expect(keyedContentBlocks).toEqual({
        // title is ignored because it's not in AllowedDataPageGdocFields
        faqs: gdoc.content.body!.slice(3, 4),
        keyInfoText: gdoc.content.body!.slice(5, 7),
        descriptionFromSource: gdoc.content.body!.slice(8, 9),
        sourceDescription1: gdoc.content.body!.slice(10, 12),
    })
})
