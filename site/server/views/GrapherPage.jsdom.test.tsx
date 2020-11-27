#! /usr/bin/env jest

import * as React from "react"
import { shallow, ShallowWrapper } from "enzyme"

import { GrapherPage } from "./GrapherPage"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"
import { Post } from "db/model/Post"
import { RelatedChart } from "site/client/blocks/RelatedCharts/RelatedCharts"

import { ChartListItemVariant } from "./ChartListItemVariant"
import { GrapherInterface } from "grapher/core/GrapherInterface"
import { DimensionProperty } from "grapher/core/GrapherConstants"

const mockGrapher: GrapherInterface = {
    version: 5,
    slug: "share-of-children-with-a-weight-too-low-for-their-height-wasting",
    originUrl: "https://ourworldindata.org/hunger-and-undernourishment/",
    dimensions: [
        {
            variableId: 3512,
            property: DimensionProperty.y,
        },
    ],
}

let grapher: GrapherInterface
let post: Post.Row
let relatedCharts: RelatedChart[]

beforeAll(() => {
    grapher = mockGrapher
    post = {
        id: 2681,
        title: "Hunger and Undernourishment",
        slug: "hunger-and-undernourishment",
        published_at: "Tue Oct 08 2013 17:22:54 GMT+0000 (GMT)",
        status: "publish",
        type: "page",
        updated_at: "Wed Mar 25 2020 14:11:30 GMT+0000 (GMT)",
        content: "",
    } as any
    relatedCharts = [
        {
            title: "Chart 1",
            slug: "chart-1",
        },
        {
            title: "Chart 2",
            slug: "chart-2",
        },
    ]
})

describe("when the page is rendered", () => {
    let view: ShallowWrapper

    beforeAll(
        () =>
            (view = shallow(
                <GrapherPage
                    post={post}
                    grapher={grapher}
                    relatedCharts={relatedCharts}
                />
            ))
    )

    it("preloads the data", () => {
        const path = "/grapher/data/variables/3512.json?v=5"
        const selector = `link[rel="preload"][href="${path}"]`
        expect(view.find(selector)).toHaveLength(1)
    })

    it("renders a site header", () => {
        expect(view.find(SiteHeader)).toHaveLength(1)
    })

    it("renders a figure", () => {
        const selector =
            'figure[data-grapher-src="/grapher/share-of-children-with-a-weight-too-low-for-their-height-wasting"]'
        expect(view.find(selector)).toHaveLength(1)
    })

    it("renders a related content block", () => {
        expect(view.find(ChartListItemVariant)).toHaveLength(2)
    })

    it("renders a site footer", () => {
        expect(view.find(SiteFooter)).toHaveLength(1)
    })
})
