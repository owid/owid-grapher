#! /usr/bin/env jest
import { configure, mount } from "enzyme"
import Adapter from "enzyme-adapter-react-16"
configure({ adapter: new Adapter() })

// This just does a sanity check that all the stories can mount.
// This file might not be necessary as there may be a way to do something similar with Storybook/Jest.
// For now, to get a list of all stories for updating this file:
// git ls-tree -r master --name-only | grep .stories.tsx | sed 's/.tsx//'

import * as StackedAreaChart from "./src/stackedCharts/StackedAreaChart.stories"
import * as DiscreteBarChart from "./src/barCharts/DiscreteBarChart.stories"
import * as CaptionedChart from "./src/captionedChart/CaptionedChart.stories"
import * as NoDataModal from "./src/noDataModal/NoDataModal.stories"
import * as CollapsibleList from "./src/controls/CollapsibleList/CollapsibleList.stories"
import * as CommandPalette from "./src/controls/CommandPalette.stories"
import * as EntityPicker from "./src/controls/entityPicker/EntityPicker.stories"
import * as ScaleSelector from "./src/controls/ScaleSelector.stories"
import * as GlobalEntitySelector from "./src/controls/globalEntitySelector/GlobalEntitySelector.stories"
import * as Grapher from "./src/core/Grapher.stories"
import * as DataTable from "./src/dataTable/DataTable.stories"
import * as FacetChart from "./src/facetChart/FacetChart.stories"
import * as Footer from "./src/footer/Footer.stories"
import * as Header from "./src/header/Header.stories"
import * as LineChart from "./src/lineCharts/LineChart.stories"
import * as LoadingIndicator from "./src/loadingIndicator/LoadingIndicator.stories"
import * as ScatterPlot from "./src/scatterCharts/ScatterPlotChart.stories"
import * as SlopeChart from "./src/slopeCharts/SlopeChart.stories"
import * as TimelineComponent from "./src/timeline/TimelineComponent.stories"
import * as StackedBarChart from "./src/stackedCharts/StackedBarChart.stories"
import * as DownloadTab from "./src/downloadTab/DownloadTab.stories"
import * as LineLegend from "./src/lineLegend/LineLegend.stories"
import * as MapChart from "./src/mapCharts/MapChart.stories"
import * as MapTooltip from "./src/mapCharts/MapTooltip.stories"
import * as Spreadsheet from "./src/spreadsheet/Spreadsheet.stories"
import * as SourcesTab from "./src/sourcesTab/SourcesTab.stories"
import * as VerticalColorLegend from "./src/verticalColorLegend/VerticalColorLegend.stories"

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
runTests(GlobalEntitySelector)
runTests(Spreadsheet)
runTests(VerticalColorLegend)
