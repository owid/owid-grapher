#! /usr/bin/env yarn jest

import { shallow } from "enzyme"

// This just does a sanity check that all the stories can do a shallow render.
// This file might not be necessary, or there may be a way to do something similar with Storybook/Jest
// For now, to get a list of all stories for updating this file:
// git ls-tree -r master --name-only | grep .stories.tsx | sed 's/.tsx//'

import * as SwitcherExplorer from "explorer/client/SwitcherExplorer.stories"
import * as CovidExplorer from "explorer/covidExplorer/CovidExplorer.stories"
import * as StackedAreaChart from "grapher/areaCharts/StackedAreaChart.stories"
import * as DiscreteBarChart from "grapher/barCharts/DiscreteBarChart.stories"
import * as ChartTab from "grapher/chart/ChartTab.stories"
import * as NoDataOverlay from "grapher/chart/NoDataOverlay.stories"
import * as CollapsibleList from "grapher/controls/CollapsibleList/CollapsibleList.stories"
import * as CommandPalette from "grapher/controls/CommandPalette.stories"
import * as CountryPicker from "grapher/controls/CountryPicker.stories"
import * as ScaleSelector from "grapher/controls/ScaleSelector.stories"
import * as Grapher from "grapher/core/Grapher.stories"
import * as DataTable from "grapher/dataTable/DataTable.stories"
import * as FacetChart from "grapher/facetChart/FacetChart.stories"
import * as Footer from "grapher/footer/Footer.stories"
import * as Header from "grapher/header/Header.stories"
import * as LineChart from "grapher/lineCharts/LineChart.stories"
import * as ScatterPlot from "grapher/scatterCharts/ScatterPlot.stories"
import * as SlopeChart from "grapher/slopeCharts/SlopeChart.stories"
import * as TimelineComponent from "grapher/timeline/TimelineComponent.stories"
import * as Feedback from "site/client/Feedback.stories"

const runTests = (storybook: any) => {
    const defaults = storybook.default
    Object.keys(storybook).forEach((key) => {
        if (key === "default") return
        describe(defaults.title, () => {
            const args = {}
            it(`should load ${key}`, () => {
                expect(shallow(storybook[key](args))).toBeTruthy()
            })
        })
    })
}

runTests(SwitcherExplorer)
runTests(CovidExplorer)
runTests(StackedAreaChart)
runTests(DiscreteBarChart)
runTests(ChartTab)
runTests(NoDataOverlay)
runTests(CollapsibleList)
runTests(CommandPalette)
runTests(CountryPicker)
runTests(ScaleSelector)
runTests(Grapher)
runTests(DataTable)
runTests(FacetChart)
runTests(Footer)
runTests(Header)
runTests(LineChart)
runTests(ScatterPlot)
runTests(SlopeChart)
runTests(TimelineComponent)
runTests(Feedback)
