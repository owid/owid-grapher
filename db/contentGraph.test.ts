#! /usr/bin/env yarn jest

import {
    DocumentNode,
    GraphDocumentType,
    GraphType,
    TopicId,
} from "../clientUtils/owidTypes.js"
import { slugify } from "../clientUtils/Util.js"
import {
    addDocumentsToGraph,
    fortuneRecordTypes,
    getGrapherSlugs,
} from "./contentGraph.js"
import fortune from "fortune" // Works in web browsers, too.

const slugs = [
    "share-of-deaths-by-cause",
    "share-of-deaths-by-cause-2016",
    "life-expectancy",
]

const getIframe = (slug: string): string => {
    return `<iframe src="http://ourworldindata.org/grapher/${slug}?tab=chart&stackMode=absolute&region=World" loading="lazy" style="width: 100%; height: 600px; border: 0px none;"></iframe>`
}

const getLink = (slug: string): string => {
    return `<a href=\"https:\/\/ourworldindata.org\/grapher\/${slug}\">here<\/a>`
}

const getContent = (slugs: string[]): string => {
    return `
    <p>Sed lacinia vehicula commodo. Praesent vehicula ipsum nec justo vulputate, at
    pellentesque nisi lacinia. Mauris dapibus non orci ut blandit. Maecenas nibh
    ${getLink(
        slugs[0]
    )} diam, condimentum sed maximus a, egestas sed eros. Ut et massa vulputate lacus
    volutpat lectus. Interdum ${getIframe(
        slugs[1]
    )} et malesuada fames ac ante ipsum primis in faucibus.
    Donec venenatis volutpat velit, a tempor risus mattis ac.
    This is data from Schutte, A. E. (2017). ${getIframe(
        slugs[0]
    )}Global, regional, and national age-sex specific mortality
    for 264 causes of death, 1980-2016: a ${getIframe(
        slugs[2]
    )}systematic analysis for the Global Burden of Disease Study 2016.
    Available <a href=\"http:\/\/www.thelancet.com\/pdfs\/journals\/lancet\/PIIS0140-6736(17)32152-9.pdf\">online<\/a>.
    {\/ref}<\/p>
    `
}

const getTopicTitle = (id: TopicId) => {
    return `topic ${id}`
}

const getTopic = (
    id: TopicId,
    parentTopics?: Array<TopicId>
): DocumentNode => ({
    id,
    title: getTopicTitle(id),
    slug: slugify(getTopicTitle(id)),
    content: null,
    type: GraphDocumentType.Topic,
    image: null,
    parentTopics: parentTopics ?? [],
})

it("extracts unique grapher slugs", () => {
    const matchedSlugsSet = getGrapherSlugs(getContent(slugs))
    const matchedSlugs = Array.from(matchedSlugsSet)

    expect(matchedSlugs).toHaveLength(3)
    matchedSlugs.forEach((slug, idx) => {
        expect(slug).toEqual(slugs[idx])
    })
})

// Not really a test - kept for documentation purposes
it("demos basic fortune bi-directional capabilities", async () => {
    const graph = fortune(fortuneRecordTypes)

    await graph.create(GraphType.Document, { id: 1, title: "topic 1" })
    await graph.create(GraphType.Document, {
        id: 11,
        title: "topic 1.1",
        parentTopics: [1],
    })
    await graph.create(GraphType.Document, {
        id: 12,
        title: "topic 1.2",
        parentTopics: [1],
    })

    const childrenTopics = (await graph.find(GraphType.Document, 1)).payload
        .records[0].childrenTopics

    expect(childrenTopics).toEqual([11, 12])
})

it("updates topic referenced and created as parent first", async () => {
    const graph = fortune(fortuneRecordTypes)

    const topic11 = getTopic(11, [1])
    const topic12 = getTopic(12, [1])
    const topic1 = getTopic(1)

    await addDocumentsToGraph([topic11, topic12, topic1], graph)

    const topic1FromGraph = (await graph.find(GraphType.Document, 1)).payload
        .records[0]

    expect(topic1FromGraph.childrenTopics).toEqual([11, 12])
    expect(topic1FromGraph.title).toEqual(getTopicTitle(1))
})
