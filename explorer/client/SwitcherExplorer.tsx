import React from "react"
import { observer } from "mobx-react"
import { action, observable, when, reaction, autorun } from "mobx"
import { ChartConfig, ChartConfigProps } from "charts/ChartConfig"
import { uniq } from "charts/Util"
import { ExplorerControlPanel } from "explorer/client/ExplorerControls"
import { ExtendedChartUrl } from "charts/ChartUrl"
import ReactDOM from "react-dom"
import { UrlBinder } from "charts/UrlBinder"
import { ExplorerShell } from "./ExplorerShell"
import { ExplorerProgram } from "./ExplorerProgram"
import { strToQueryParams } from "utils/client/url"

declare type chartId = number

export interface SwitcherBootstrapProps {
    explorerProgramCode: string
    slug: string
    chartConfigs: ChartConfigProps[]
    bindToWindow: boolean
}

@observer
export class SwitcherExplorer extends React.Component<{
    chartConfigs: Map<chartId, ChartConfigProps>
    program: ExplorerProgram
    bindToWindow: boolean
}> {
    static bootstrap(props: SwitcherBootstrapProps) {
        const { chartConfigs, explorerProgramCode, bindToWindow, slug } = props
        const containerId = "explorerContainer"
        const containerNode = document.getElementById(containerId)
        const program = new ExplorerProgram(
            slug,
            explorerProgramCode,
            window.location.search
        )
        const chartConfigsMap: Map<number, ChartConfigProps> = new Map()
        chartConfigs.forEach(config => chartConfigsMap.set(config.id!, config))

        return ReactDOM.render(
            <SwitcherExplorer
                program={program}
                chartConfigs={chartConfigsMap}
                bindToWindow={bindToWindow}
            />,
            containerNode
        )
    }

    urlBinding?: UrlBinder
    private lastId = 0

    @observable private _chart?: ChartConfig = undefined
    @observable availableEntities: string[] = []

    get explorerRuntime() {
        return this.props.program.explorerRuntime
    }

    get switcherRuntime() {
        return this.props.program.switcherRuntime
    }

    bindToWindow() {
        const url = new ExtendedChartUrl(this._chart!.url, [
            this.switcherRuntime,
            this.explorerRuntime
        ])

        if (this.urlBinding) this.urlBinding.unbindFromWindow()
        else this.urlBinding = new UrlBinder()

        this.urlBinding.bindToWindow(url)
        const win = window as any
        win.switcherExplorer = this
    }

    componentWillMount() {
        // todo: add disposer
        reaction(() => this.switcherRuntime.chartId, this.switchChart, {
            fireImmediately: true
        })
    }

    componentDidMount() {
        autorun(() => {
            this.explorerRuntime.selectedEntityNames.size // "Dot in" to create Mobx link.
            this.updateChartSelection()
        })
    }

    @action.bound switchChart() {
        const newId: number = this.switcherRuntime.chartId
        if (newId === this.lastId) return

        const params = this._chart
            ? this._chart.url.params
            : strToQueryParams(this.props.program.queryString)
        const props =
            this.props.chartConfigs.get(newId) || new ChartConfigProps()

        this._chart = new ChartConfig(props)
        this._chart.url.populateFromQueryParams(params)
        this._chart.hideEntityControls =
            !this.explorerRuntime.hideControls && !this.isEmbed

        if (this.props.bindToWindow) this.bindToWindow()

        // disposer?
        when(
            () => this._chart!.isReady,
            () => {
                // Add any missing entities
                this.availableEntities = uniq([
                    ...this.availableEntities,
                    ...this._chart!.table.availableEntities
                ]).sort()

                this.updateChartSelection()
            }
        )

        this.lastId = newId
    }

    private isSelected(entityName: string) {
        return this.explorerRuntime.selectedEntityNames.has(entityName)
    }

    @action.bound private updateChartSelection() {
        const table = this._chart!.table
        const entityIdMap = table.entityNameToIdMap
        const selectedData = Array.from(
            this.explorerRuntime.selectedEntityNames
        )
            .filter(i => i)
            .map(countryOption => {
                return {
                    index: 0,
                    entityId: countryOption
                        ? entityIdMap.get(countryOption)!
                        : 0
                }
            })

        this._chart!.props.selectedData = selectedData
    }

    get panels() {
        return this.switcherRuntime.groups.map(group => (
            <ExplorerControlPanel
                key={group.title}
                value={group.value}
                title={group.title}
                explorerSlug={this.props.program.slug}
                name={group.title}
                dropdownOptions={group.dropdownOptions}
                options={group.options}
                isCheckbox={group.isCheckbox}
                onChange={value => {
                    this.switcherRuntime.setValue(group.title, value)
                }}
            />
        ))
    }

    get header() {
        return (
            <>
                <div></div>
                <div className="ExplorerTitle">{this.props.program.title}</div>
                <div
                    className="ExplorerSubtitle"
                    dangerouslySetInnerHTML={{
                        __html: this.props.program.subtitle || ""
                    }}
                ></div>
            </>
        )
    }

    //todo
    get isEmbed() {
        return false
    }

    render() {
        return (
            <ExplorerShell
                headerElement={this.header}
                controlPanels={this.panels}
                explorerSlug={this.props.program.slug}
                availableEntities={this.availableEntities}
                chart={this._chart!}
                params={this.explorerRuntime}
                isEmbed={this.isEmbed}
            />
        )
    }
}
