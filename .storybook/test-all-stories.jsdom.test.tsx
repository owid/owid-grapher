#! /usr/bin/env jest
import { configure, mount } from "enzyme"
import Adapter from "enzyme-adapter-react-16"
configure({ adapter: new Adapter() })

// This just does a sanity check that all the stories can mount.
// This file might not be necessary as there may be a way to do something similar with Storybook/Jest.
// For now, to get a list of all stories for updating this file:
// git ls-tree -r master --name-only | grep .stories.tsx | sed 's/.tsx//'

import * as Explorer from "explorer/Explorer.stories"
import * as StackedAreaChart from "grapher/stackedCharts/StackedAreaChart.stories"
import * as DiscreteBarChart from "grapher/barCharts/DiscreteBarChart.stories"
import * as CaptionedChart from "grapher/captionedChart/CaptionedChart.stories"
import * as NoDataModal from "grapher/noDataModal/NoDataModal.stories"
import * as CollapsibleList from "grapher/controls/CollapsibleList/CollapsibleList.stories"
import * as CommandPalette from "grapher/controls/CommandPalette.stories"
import * as EntityPicker from "grapher/controls/entityPicker/EntityPicker.stories"
import * as ScaleSelector from "grapher/controls/ScaleSelector.stories"
import * as GlobalEntityControl from "grapher/controls/globalEntityControl/GlobalEntityControl.stories"
import * as Grapher from "grapher/core/Grapher.stories"
import * as DataTable from "grapher/dataTable/DataTable.stories"
import * as FacetChart from "grapher/facetChart/FacetChart.stories"
import * as Footer from "grapher/footer/Footer.stories"
import * as Header from "grapher/header/Header.stories"
import * as LineChart from "grapher/lineCharts/LineChart.stories"
import * as LoadingIndicator from "grapher/loadingIndicator/LoadingIndicator.stories"
import * as ScatterPlot from "grapher/scatterCharts/ScatterPlotChart.stories"
import * as SlopeChart from "grapher/slopeCharts/SlopeChart.stories"
import * as TimelineComponent from "grapher/timeline/TimelineComponent.stories"
import * as Feedback from "site/client/Feedback.stories"
import * as StackedBarChart from "grapher/stackedCharts/StackedBarChart.stories"
import * as DownloadTab from "grapher/downloadTab/DownloadTab.stories"
import * as LineLegend from "grapher/lineLegend/LineLegend.stories"
import * as MapChart from "grapher/mapCharts/MapChart.stories"
import * as MapTooltip from "grapher/mapCharts/MapTooltip.stories"
import * as Spreadsheet from "grapher/spreadsheet/Spreadsheet.stories"
import * as SourcesTab from "grapher/sourcesTab/SourcesTab.stories"
import * as VerticalColorLegend from "grapher/verticalColorLegend/VerticalColorLegend.stories"

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

runTests(Explorer)
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
runTests(Feedback)
runTests(StackedBarChart)
runTests(DownloadTab)
runTests(LineLegend)
runTests(MapChart)
runTests(MapTooltip)
runTests(SourcesTab)
runTests(GlobalEntityControl)
runTests(Spreadsheet)
runTests(VerticalColorLegend)
