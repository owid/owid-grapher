import { ExploreModel } from "charts/ExploreModel"

describe(ExploreModel, () => {
    describe("when you give it a query string", () => {
        let model: ExploreModel

        beforeAll(() => {
            const queryStr = "indicator=488&time=1960..2000&type=WorldMap"
            model = new ExploreModel()
            model.populateFromQueryStr(queryStr)
        })

        it("populates the indicator id", () => {
            expect(model.indicatorId).toBe(488)
        })

        it("populates the chart type", () => {
            expect(model.chartType).toBe("WorldMap")
        })

        it("populates the chart params", () => {
            expect(model.chart.timeDomain).toEqual([1960, 2000])
        })
    })
})
