// WIP replacement for owid.chart.jsx

import * as React from 'react'
import * as d3 from 'd3'
import {computed} from 'mobx'

import ChartConfig from './ChartConfig'
import SourcesFooter from './SourcesFooter'
import ControlsFooter from './ControlsFooter'
import ChartTab from './ChartTab'
import DataTab from './DataTab'
import MapTab from './MapTab'
import SourcesTab from './SourcesTab'
import DownloadTab from './DownloadTab'
import VariableData from './App.Models.VariableData'
import ChartData from './App.Models.ChartData'
import Colors from './App.Models.Colors'
import Header from './App.Views.Chart.Header'
import Export from './App.Views.Export'
import UrlBinder from './App.Views.ChartURL'
import mapdata from './owid.models.mapdata'

declare const App: any // XXX

interface ChartFrameProps {
    jsonConfig: any
}

export default class ChartFrame extends React.Component<ChartFrameProps, null> {
    @computed get landscapeAuthorDimensions() {
        return [850, 600]
    }

    @computed get portraitAuthorDimensions() {
        return [400, 640]
    }

    @computed get isExport() { return !!window.location.pathname.match(/.export$/) }
    @computed get isEditor() { return App.isEditor }
    @computed get isEmbed() { return window.self != window.top || this.isEditor }
    @computed get isMobile() { return d3.select('html').classed('touchevents') }

    constructor() {
        super()
        // XXX all of this stuff needs refactoring
        this.model = new ChartModel(this.props.jsonConfig)
        App.ChartModel = this.model
        this.config = new ChartConfig(model)
        App.VariableData = new VariableData()
        App.ChartData = new ChartData()
        App.Colors = new Colors(this)
        App.ChartModel.bind()
        this.map = App.MapModel
        this.mapdata = mapdata(this)
        this.url = UrlBinder(this)
        this.tooltip = new owid.view.tooltip(this)
    }
}
