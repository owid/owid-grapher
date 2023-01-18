import { OwidArticleContent } from "@ourworldindata/utils"
import { createGdocAndInsertOwidArticleContent } from "./model/Gdoc/archieToGdoc.js"

async function testCreateGdoc() {
    const article = {
        title: "Title",
        subtitle: "Subtitle",
        supertitle: "Supertitle",
        template: "Template",
        byline: "Byline",
        dateline: "Dateline",
        excerpt: "Excerpt",
        summary: [
            {
                type: "text" as const,
                value: [
                    {
                        spanType: "span-simple-text" as const,
                        text: "Summary text",
                    },
                ],
                parseErrors: [],
            },
        ],
        citation: [
            {
                type: "simple-text" as const,
                value: {
                    spanType: "span-simple-text" as const,
                    text: "Citation text",
                },
                parseErrors: [],
            },
        ],
        coverImage: "Cover image",
        coverColor: "Cover color",
        featuredImage: "Featured image",
        body: [
            {
                type: "text" as const,
                value: [
                    {
                        spanType: "span-simple-text" as const,
                        text: "Body text",
                    },
                ],
                parseErrors: [],
            },
        ],
    } as OwidArticleContent

    const docId = await createGdocAndInsertOwidArticleContent(article)
    console.log("done, created doc with id: ", docId)
}

testCreateGdoc()
