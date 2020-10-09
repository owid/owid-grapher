import React from "react"
import { observer } from "mobx-react"
import { action, observable, computed, autorun, when } from "mobx"
import { GrapherInterface } from "grapher/core/GrapherInterface"
import { ExplorerControlPanel } from "explorer/client/ExplorerControls"
import ReactDOM from "react-dom"
import {
    UrlBinder,
    ObservableUrl,
    MultipleUrlBinder,
} from "grapher/utils/UrlBinder"
import { ExplorerShell } from "./ExplorerShell"
import { ExplorerProgram } from "./ExplorerProgram"
import { QueryParams, strToQueryParams } from "utils/client/url"
import { EntityUrlBuilder } from "grapher/core/EntityUrlBuilder"
import { OwidTable } from "coreTable/OwidTable"
import { GrapherProgrammaticInterface } from "grapher/core/Grapher"
import { exposeInstanceOnWindow } from "grapher/utils/Util"

export interface SwitcherExplorerProps {
    explorerProgramCode: string
    slug: string
    chartConfigs?: GrapherInterface[]
    bindToWindow?: boolean
    queryString?: string
}

@observer
export class SwitcherExplorer
    extends React.Component<SwitcherExplorerProps>
    implements ObservableUrl {
    static bootstrap(props: SwitcherExplorerProps) {
        return ReactDOM.render(
            <SwitcherExplorer
                {...props}
                queryString={window.location.search}
            />,
            document.getElementById("explorerContainer")
        )
    }

    private urlBinding?: UrlBinder

    private explorerProgram = new ExplorerProgram(
        this.props.slug,
        this.props.explorerProgramCode,
        this.props.queryString
    )

    @observable hideControls = false

    @computed get params(): QueryParams {
        const params: any = {}
        params.hideControls = this.hideControls ? true : undefined
        params.country = EntityUrlBuilder.entitiesToQueryParam(
            this.countryPickerTable.selectedEntityNames
        )
        return params as QueryParams
    }

    @computed get chartConfigs() {
        const arr = this.props.chartConfigs || []
        const chartConfigsMap: Map<number, GrapherInterface> = new Map()
        arr.forEach((config) => chartConfigsMap.set(config.id!, config))
        return chartConfigsMap
    }

    // The country picker can have entities not present in all charts
    @action.bound private async addEntityOptionsToPickerWhenReady() {
        if (!this.grapher) return
        await this.grapher.whenReady()
        this.addEntityOptionsToPicker()
    }

    @action.bound private addEntityOptionsToPicker() {
        if (!this.grapher) return
        const currentEntities = this.countryPickerTable.availableEntityNameSet
        const newEntities = this.grapher.rootTable.availableEntityNameSet
        const missingEntities = [...newEntities]
            .filter((entityName) => !currentEntities.has(entityName))
            .map((entityName) => {
                return {
                    entityName,
                }
            })
        this.countryPickerTable = this.countryPickerTable.withRows(
            missingEntities
        ) as OwidTable
        this.countryPickerTable.addToSelection(
            this.grapher.rootTable.selectedEntityNames
        )
    }

    @computed get grapher() {
        return this.explorerRef.current?.grapherRef?.current
    }

    componentDidMount() {
        autorun(() =>
            this.switchGrapherConfig(
                this.explorerProgram.switcherRuntime.chartId
            )
        )

        when(
            () => !!this.grapher,
            () => {
                this.switchGrapherConfig(
                    this.explorerProgram.switcherRuntime.chartId
                )
            }
        )

        autorun(() => {
            this.updateSelection(this.countryPickerTable.selectedEntityNames)
        })

        exposeInstanceOnWindow(this, "switcherExplorer")
    }

    @action.bound private updateSelection(entityNames: string[]) {
        if (!this.countryPickerTable.numRows) return
        if (this.grapher)
            this.grapher.rootTable.setSelectedEntities(entityNames)
    }

    @action.bound private switchGrapherConfig(id: number) {
        if (!this.grapher || this.grapher.id === id) return

        const config: GrapherProgrammaticInterface = {
            ...this.chartConfigs.get(id)!,
            enableKeyboardShortcuts: true,
            hideEntityControls: !this.hideControls && !this.isEmbed,
            dropUnchangedUrlParams: false,
        }

        this.grapher.hasError = false
        const queryStr = this.grapher.id
            ? this.grapher.queryStr
            : this.explorerProgram.queryString

        this.grapher.updateFromObject(config)
        this.grapher.rootTable = new OwidTable()
        this.grapher.populateFromQueryParams(strToQueryParams(queryStr ?? ""))
        this.grapher.downloadData()
        this.addEntityOptionsToPickerWhenReady()
        this.bindToWindow()
    }

    bindToWindow() {
        if (!this.props.bindToWindow || !this.grapher) return

        if (this.urlBinding) this.urlBinding.unbindFromWindow()
        else this.urlBinding = new UrlBinder()
        this.urlBinding.bindToWindow(
            new MultipleUrlBinder([
                this.grapher,
                this.explorerProgram.switcherRuntime,
                this,
            ])
        )
    }

    @observable.ref countryPickerTable = new OwidTable()

    private get panels() {
        return this.explorerProgram.switcherRuntime.groups.map((group) => (
            <ExplorerControlPanel
                key={group.title}
                value={group.value}
                title={group.title}
                explorerSlug={this.explorerProgram.slug}
                name={group.title}
                dropdownOptions={group.dropdownOptions}
                options={group.options}
                isCheckbox={group.isCheckbox}
                onChange={(value) => {
                    this.explorerProgram.switcherRuntime.setValue(
                        group.title,
                        value
                    )
                }}
            />
        ))
    }

    private get header() {
        return (
            <>
                <div></div>
                <div className="ExplorerTitle">
                    {this.explorerProgram.title}
                </div>
                <div
                    className="ExplorerSubtitle"
                    dangerouslySetInnerHTML={{
                        __html: this.explorerProgram.subtitle || "",
                    }}
                ></div>
            </>
        )
    }

    //todo
    private get isEmbed() {
        return false
    }

    @observable.ref explorerRef: React.RefObject<
        ExplorerShell
    > = React.createRef()

    render() {
        return (
            <ExplorerShell
                headerElement={this.header}
                controlPanels={this.panels}
                explorerSlug={this.explorerProgram.slug}
                countryPickerTable={this.countryPickerTable}
                hideControls={this.hideControls}
                isEmbed={this.isEmbed}
                ref={this.explorerRef}
            />
        )
    }
}
