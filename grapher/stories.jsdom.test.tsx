#! /usr/bin/env jest
import { configure, mount } from "enzyme"
import Adapter from "enzyme-adapter-react-16"
configure({ adapter: new Adapter() })

// This just does a sanity check that all the stories can mount.
// This file might not be necessary as there may be a way to do something similar with Storybook/Jest.
// For now, to get a list of all stories for updating this file:
// git ls-tree -r master --name-only | grep .stories.tsx | sed 's/.tsx//'

import * as StackedAreaChart from "./stackedCharts/StackedAreaChart.stories"
import * as DiscreteBarChart from "./barCharts/DiscreteBarChart.stories"
import * as CaptionedChart from "./captionedChart/CaptionedChart.stories"
import * as NoDataModal from "./noDataModal/NoDataModal.stories"
import * as CollapsibleList from "./controls/CollapsibleList/CollapsibleList.stories"
import * as CommandPalette from "./controls/CommandPalette.stories"
import * as EntityPicker from "./controls/entityPicker/EntityPicker.stories"
import * as ScaleSelector from "./controls/ScaleSelector.stories"
import * as GlobalEntityControl from "./controls/globalEntitySelector/GlobalEntitySelector.stories"
import * as Grapher from "./core/Grapher.stories"
import * as DataTable from "./dataTable/DataTable.stories"
import * as FacetChart from "./facetChart/FacetChart.stories"
import * as Footer from "./footer/Footer.stories"
import * as Header from "./header/Header.stories"
import * as LineChart from "./lineCharts/LineChart.stories"
import * as LoadingIndicator from "./loadingIndicator/LoadingIndicator.stories"
import * as ScatterPlot from "./scatterCharts/ScatterPlotChart.stories"
import * as SlopeChart from "./slopeCharts/SlopeChart.stories"
import * as TimelineComponent from "./timeline/TimelineComponent.stories"
import * as StackedBarChart from "./stackedCharts/StackedBarChart.stories"
import * as DownloadTab from "./downloadTab/DownloadTab.stories"
import * as LineLegend from "./lineLegend/LineLegend.stories"
import * as MapChart from "./mapCharts/MapChart.stories"
import * as MapTooltip from "./mapCharts/MapTooltip.stories"
import * as Spreadsheet from "./spreadsheet/Spreadsheet.stories"
import * as SourcesTab from "./sourcesTab/SourcesTab.stories"
import * as VerticalColorLegend from "./verticalColorLegend/VerticalColorLegend.stories"

const runTests = (storybook: any) => {
    const defaults = storybook.default
    Object.keys(storybook).forEach((key) => {
        if (key === "default") return
        describe(defaults.title, () => {
            const args = {}
            it(`should load ${key}`, () => {
                expect(mount(storybook[key](args))).toBeTruthy()
            })
        })
    })
}

runTests(StackedAreaChart)
runTests(DiscreteBarChart)
runTests(CaptionedChart)
runTests(NoDataModal)
runTests(CollapsibleList)
runTests(CommandPalette)
runTests(EntityPicker)
runTests(ScaleSelector)
runTests(Grapher)
runTests(DataTable)
runTests(FacetChart)
runTests(Footer)
runTests(Header)
runTests(LineChart)
runTests(LoadingIndicator)
runTests(ScatterPlot)
runTests(SlopeChart)
runTests(TimelineComponent)
runTests(StackedBarChart)
runTests(DownloadTab)
runTests(LineLegend)
runTests(MapChart)
runTests(MapTooltip)
runTests(SourcesTab)
runTests(GlobalEntityControl)
runTests(Spreadsheet)
runTests(VerticalColorLegend)
