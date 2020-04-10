#! /usr/bin/env jest

import * as React from "react"
import { shallow, ShallowWrapper } from "enzyme"

import { ChartPage } from "../ChartPage"
import { SiteHeader } from "../SiteHeader"
import { SiteFooter } from "../SiteFooter"
import { extend } from "charts/Util"
import { ChartConfigProps } from "charts/ChartConfig"
import { Post } from "db/model/Post"
import { RelatedChart } from "site/client/blocks/RelatedCharts/RelatedCharts"

import * as fixtures from "test/fixtures"

describe(ChartPage, () => {
    let chart: ChartConfigProps
    let post: Post.Row
    let relatedCharts: RelatedChart[]

    beforeAll(() => {
        chart = new ChartConfigProps()
        extend(chart, fixtures.readChart(792))
        post = fixtures.readPost(2681)
        relatedCharts = fixtures.readChartsPost(2681)
    })

    describe("when the page is rendered", () => {
        let view: ShallowWrapper

        beforeAll(
            () =>
                (view = shallow(
                    <ChartPage
                        post={post}
                        chart={chart}
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
            const selector = ".related-research-data li"
            expect(view.find(selector)).toHaveLength(2)
        })

        it("renders a site footer", () => {
            expect(view.find(SiteFooter)).toHaveLength(1)
        })
    })
})
