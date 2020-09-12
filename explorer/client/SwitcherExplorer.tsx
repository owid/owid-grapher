import React from "react"
import { observer } from "mobx-react"
import { action, observable, when, reaction, autorun } from "mobx"
import { GrapherInterface } from "grapher/core/GrapherInterface"
import { Grapher } from "grapher/core/Grapher"
import { uniq } from "grapher/utils/Util"
import { ExplorerControlPanel } from "explorer/client/ExplorerControls"
import { ExtendedGrapherUrl } from "grapher/core/GrapherUrl"
import ReactDOM from "react-dom"
import { UrlBinder } from "grapher/utils/UrlBinder"
import { ExplorerShell } from "./ExplorerShell"
import { ExplorerProgram } from "./ExplorerProgram"
import { strToQueryParams } from "utils/client/url"

declare type chartId = number

export interface SwitcherBootstrapProps {
    explorerProgramCode: string
    slug: string
    chartConfigs: GrapherInterface[]
    bindToWindow: boolean
}

@observer
export class SwitcherExplorer extends React.Component<{
    chartConfigs: Map<chartId, GrapherInterface>
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
        const chartConfigsMap: Map<number, GrapherInterface> = new Map()
        chartConfigs.forEach((config) =>
            chartConfigsMap.set(config.id!, config)
        )

        return ReactDOM.render(
            <SwitcherExplorer
                program={program}
                chartConfigs={chartConfigsMap}
                bindToWindow={bindToWindow}
            />,
            containerNode
        )
    }

    private urlBinding?: UrlBinder
    private lastId = 0

    @observable availableEntities: string[] = []

    private get explorerRuntime() {
        return this.props.program.explorerRuntime
    }

    private get switcherRuntime() {
        return this.props.program.switcherRuntime
    }

    @observable private _grapher?: Grapher = this.setGrapher(
        this.switcherRuntime.chartId
    )

    private bindToWindow() {
        const url = new ExtendedGrapherUrl(this._grapher!.url, [
            this.switcherRuntime,
            this.explorerRuntime,
        ])

        if (this.urlBinding) this.urlBinding.unbindFromWindow()
        else this.urlBinding = new UrlBinder()

        this.urlBinding.bindToWindow(url)
        const win = window as any
        win.switcherExplorer = this
    }

    componentDidMount() {
        autorun(() => {
            this.explorerRuntime.selectedEntityNames.size // "Dot in" to create Mobx link.
            this.updateGrapherSelection()
        })

        // todo: add disposer?
        reaction(() => this.switcherRuntime.chartId, this.switchGrapher, {
            fireImmediately: true,
        })
    }

    @action.bound private setGrapher(newId: number) {
        const currentParams = this._grapher
            ? this._grapher.url.params
            : strToQueryParams(this.props.program.queryString)

        this._grapher = new Grapher(this.props.chartConfigs.get(newId))
        this._grapher.url.dropUnchangedParams = false
        this._grapher.hideEntityControls =
            !this.explorerRuntime.hideControls && !this.isEmbed
        if (this.props.bindToWindow) this.bindToWindow()

        this._grapher.populateFromQueryParams(currentParams)

        // disposer?
        when(
            () => this._grapher!.isReady,
            () => {
                // Add any missing entities
                this.availableEntities = uniq([
                    ...this.availableEntities,
                    ...this._grapher!.table.availableEntities,
                ]).sort()

                this.updateGrapherSelection()
            }
        )

        this.lastId = newId
        return this._grapher
    }

    @action.bound private switchGrapher() {
        const newId = this.switcherRuntime.chartId
        if (newId === this.lastId) return
        this.setGrapher(newId)
    }

    @action.bound private updateGrapherSelection() {
        const table = this._grapher!.table
        const entityIdMap = table.entityNameToIdMap
        const selectedData = Array.from(
            this.explorerRuntime.selectedEntityNames
        )
            .filter((i) => i)
            .map((countryOption) => {
                return {
                    index: 0,
                    entityId: countryOption
                        ? entityIdMap.get(countryOption)!
                        : 0,
                }
            })

        this._grapher!.selectedData = selectedData
    }

    private get panels() {
        return this.switcherRuntime.groups.map((group) => (
            <ExplorerControlPanel
                key={group.title}
                value={group.value}
                title={group.title}
                explorerSlug={this.props.program.slug}
                name={group.title}
                dropdownOptions={group.dropdownOptions}
                options={group.options}
                isCheckbox={group.isCheckbox}
                onChange={(value) => {
                    this.switcherRuntime.setValue(group.title, value)
                }}
            />
        ))
    }

    private get header() {
        return (
            <>
                <div></div>
                <div className="ExplorerTitle">{this.props.program.title}</div>
                <div
                    className="ExplorerSubtitle"
                    dangerouslySetInnerHTML={{
                        __html: this.props.program.subtitle || "",
                    }}
                ></div>
            </>
        )
    }

    //todo
    private get isEmbed() {
        return false
    }

    render() {
        return (
            <ExplorerShell
                headerElement={this.header}
                controlPanels={this.panels}
                explorerSlug={this.props.program.slug}
                availableEntities={this.availableEntities}
                grapher={this._grapher!}
                params={this.explorerRuntime}
                isEmbed={this.isEmbed}
            />
        )
    }
}
