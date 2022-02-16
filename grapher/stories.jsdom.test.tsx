#! /usr/bin/env jest
import enzyme from "enzyme"
import Adapter from "enzyme-adapter-react-16"
enzyme.configure({ adapter: new Adapter() })

// This just does a sanity check that all the stories can mount.
// This file might not be necessary as there may be a way to do something similar with Storybook/Jest.
// For now, to get a list of all stories for updating this file:
// git ls-tree -r master --name-only | grep .stories.tsx | sed 's/.tsx//'

import * as StackedAreaChart from "./stackedCharts/StackedAreaChart.stories.js"
import * as DiscreteBarChart from "./barCharts/DiscreteBarChart.stories.js"
import * as CaptionedChart from "./captionedChart/CaptionedChart.stories.js"
import * as NoDataModal from "./noDataModal/NoDataModal.stories.js"
import * as CollapsibleList from "./controls/CollapsibleList/CollapsibleList.stories.js"
import * as CommandPalette from "./controls/CommandPalette.stories.js"
import * as EntityPicker from "./controls/entityPicker/EntityPicker.stories.js"
import * as ScaleSelector from "./controls/ScaleSelector.stories.js"
import * as GlobalEntitySelector from "./controls/globalEntitySelector/GlobalEntitySelector.stories.js"
import * as Grapher from "./core/Grapher.stories.js"
import * as DataTable from "./dataTable/DataTable.stories.js"
import * as FacetChart from "./facetChart/FacetChart.stories.js"
import * as Footer from "./footer/Footer.stories.js"
import * as Header from "./header/Header.stories.js"
import * as LineChart from "./lineCharts/LineChart.stories.js"
import * as LoadingIndicator from "./loadingIndicator/LoadingIndicator.stories.js"
import * as ScatterPlot from "./scatterCharts/ScatterPlotChart.stories.js"
import * as SlopeChart from "./slopeCharts/SlopeChart.stories.js"
import * as TimelineComponent from "./timeline/TimelineComponent.stories.js"
import * as StackedBarChart from "./stackedCharts/StackedBarChart.stories.js"
import * as DownloadTab from "./downloadTab/DownloadTab.stories.js"
import * as LineLegend from "./lineLegend/LineLegend.stories.js"
import * as MapChart from "./mapCharts/MapChart.stories.js"
import * as MapTooltip from "./mapCharts/MapTooltip.stories.js"
import * as Spreadsheet from "./spreadsheet/Spreadsheet.stories.js"
import * as SourcesTab from "./sourcesTab/SourcesTab.stories.js"
import * as VerticalColorLegend from "./verticalColorLegend/VerticalColorLegend.stories.js"

const runTests = (storybook: any) => {
    const defaults = storybook.default
    Object.keys(storybook).forEach((key) => {
        if (key === "default") return
        describe(defaults.title, () => {
            const args = {}
            it(`should load ${key}`, () => {
                expect(enzyme.mount(storybook[key](args))).toBeTruthy()
            })
        })
    })
}

runTests(StackedAreaChart)
runTests(DiscreteBarChart)
// runTests(CaptionedChart)
runTests(NoDataModal)
// runTests(CollapsibleList)
runTests(CommandPalette)
runTests(EntityPicker)
runTests(ScaleSelector)
runTests(Grapher)
// runTests(DataTable)
runTests(FacetChart)
runTests(Footer)
runTests(Header)
runTests(LineChart)
runTests(LoadingIndicator)
runTests(ScatterPlot)
runTests(SlopeChart)
// runTests(TimelineComponent)
runTests(StackedBarChart)
runTests(DownloadTab)
runTests(LineLegend)
// runTests(MapChart)
runTests(MapTooltip)
runTests(SourcesTab)
runTests(GlobalEntitySelector)
runTests(Spreadsheet)
runTests(VerticalColorLegend)
