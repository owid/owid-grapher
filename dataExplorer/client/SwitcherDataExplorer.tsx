import React from "react"
import { observer } from "mobx-react"
import { action, observable, when, reaction, autorun } from "mobx"
import { ChartConfig, ChartConfigProps } from "charts/ChartConfig"
import { uniq, partition } from "charts/Util"
import { ExplorerControlPanel } from "dataExplorer/client/ExplorerControls"
import { ExtendedChartUrl } from "charts/ChartUrl"
import ReactDOM from "react-dom"
import { UrlBinder } from "charts/UrlBinder"
import { DataExplorerShell } from "./DataExplorerShell"
import { DataExplorerProgram } from "./DataExplorerProgram"
import { strToQueryParams } from "utils/client/url"

declare type chartId = number

export interface SwitcherBootstrapProps {
    dataExplorerProgramCode: string
    slug: string
    chartConfigs: ChartConfigProps[]
    bindToWindow: boolean
}

@observer
export class SwitcherDataExplorer extends React.Component<{
    chartConfigs: Map<chartId, ChartConfigProps>
    program: DataExplorerProgram
    bindToWindow: boolean
}> {
    static bootstrap(props: SwitcherBootstrapProps) {
        const {
            chartConfigs,
            dataExplorerProgramCode,
            bindToWindow,
            slug
        } = props
        const containerId = "dataExplorerContainer"
        const containerNode = document.getElementById(containerId)
        const program = new DataExplorerProgram(
            slug,
            dataExplorerProgramCode,
            window.location.search
        )
        const chartConfigsMap: Map<number, ChartConfigProps> = new Map()
        chartConfigs.forEach(config => chartConfigsMap.set(config.id!, config))

        return ReactDOM.render(
            <SwitcherDataExplorer
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
            this.switcherRuntime.toParams,
            this.explorerRuntime.toParams
        ])

        if (this.urlBinding) this.urlBinding.unbindFromWindow()
        else this.urlBinding = new UrlBinder()

        this.urlBinding.bindToWindow(url)
        const win = window as any
        win.switcherDataExplorer = this
    }

    componentWillMount() {
        // todo: add disposer
        reaction(() => this.switcherRuntime.chartId, this.switchChart, {
            fireImmediately: true
        })
    }

    componentDidMount() {
        autorun(() => {
            this.explorerRuntime.selectedCountryCodes.size
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

                const entities = uniq([
                    ...this.availableEntities,
                    ...this._chart!.table.availableEntities
                ])

                const [selected, unselected] = partition(
                    entities,
                    (name: string) => this.isSelected(name)
                )

                selected.sort()
                unselected.sort()

                this.availableEntities = [...selected, ...unselected]

                this.updateChartSelection()
            }
        )

        this.lastId = newId
    }

    private isSelected(entityName: string) {
        const countryCodeMap = this._chart!.table.entityCodeToNameMap
        return this.explorerRuntime.selectedCountryCodes.has(
            countryCodeMap.get(entityName)!
        )
    }

    @action.bound private updateChartSelection() {
        const table = this._chart!.table
        const countryCodeMap = table.entityCodeToNameMap
        const entityIdMap = table.entityNameToIdMap
        const selectedData = Array.from(
            this.explorerRuntime.selectedCountryCodes
        )
            .map(code => countryCodeMap.get(code))
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
                title={group.title}
                explorerSlug={this.props.program.slug}
                name={group.title}
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
            <DataExplorerShell
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
