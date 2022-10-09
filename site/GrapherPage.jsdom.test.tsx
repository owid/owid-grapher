#! /usr/bin/env jest

import { GrapherInterface } from "@ourworldindata/grapher"
import { DimensionProperty, PostRow, RelatedChart } from "@ourworldindata/utils"
import React from "react"
import { ChartListItemVariant } from "./ChartListItemVariant.js"
import { GrapherPage } from "./GrapherPage.js"
import { SiteFooter } from "./SiteFooter.js"
import { SiteHeader } from "./SiteHeader.js"

import {
    getVariableDataRoute,
    getVariableMetadataRoute,
} from "@ourworldindata/grapher"
import { configure, shallow, ShallowWrapper } from "enzyme"
import Adapter from "enzyme-adapter-react-16"
configure({ adapter: new Adapter() })

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
let post: PostRow
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
                    baseGrapherUrl={"/grapher/"}
                    baseUrl={""}
                />
            ))
    )

    it("preloads the data", () => {
        expect(
            view.find(
                `link[rel="preload"][href="${getVariableDataRoute(3512)}"]`
            )
        ).toHaveLength(1)
        expect(
            view.find(
                `link[rel="preload"][href="${getVariableMetadataRoute(3512)}"]`
            )
        ).toHaveLength(1)
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
