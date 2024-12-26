#! /usr/bin/env jest
import { GrapherInterface } from "@ourworldindata/types"
import {
    DimensionProperty,
    KeyChartLevel,
    RelatedChart,
} from "@ourworldindata/utils"
import { ChartListItemVariant } from "./ChartListItemVariant.js"
import { GrapherPage } from "./GrapherPage.js"
import { SiteFooter } from "./SiteFooter.js"
import { SiteHeader } from "./SiteHeader.js"

import Enzyme, { ShallowWrapper } from "enzyme"
import Adapter from "@wojtekmaj/enzyme-adapter-react-17"
Enzyme.configure({ adapter: new Adapter() })

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
let relatedCharts: RelatedChart[]

beforeAll(() => {
    grapher = mockGrapher
    relatedCharts = [
        {
            title: "Chart 1",
            slug: "chart-1",
            keyChartLevel: KeyChartLevel.Middle,
        },
        {
            title: "Chart 2",
            slug: "chart-2",
            keyChartLevel: KeyChartLevel.Top,
        },
    ]
})

describe("when the page is rendered", () => {
    let view: ShallowWrapper

    beforeAll(
        () =>
            (view = Enzyme.shallow(
                <GrapherPage
                    grapher={grapher}
                    relatedCharts={relatedCharts}
                    baseGrapherUrl={"/grapher/"}
                    baseUrl={""}
                />
            ))
    )

    it("preloads the data", () => {
        expect(
            view
                .find(`link[rel="preload"]`)
                .filterWhere((element: any): boolean =>
                    element.prop("href").endsWith("/3512.data.json")
                )
        ).toHaveLength(1)

        expect(
            view
                .find(`link[rel="preload"]`)
                .filterWhere((element: any): boolean =>
                    element.prop("href").endsWith("/3512.metadata.json")
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
