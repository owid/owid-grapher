import React from "react"
import { observer } from "mobx-react"
import { action, observable, computed, autorun } from "mobx"
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
import { BlankOwidTable, OwidTable } from "coreTable/OwidTable"
import { GrapherProgrammaticInterface } from "grapher/core/Grapher"
import { exposeInstanceOnWindow, fetchText } from "grapher/utils/Util"
import {
    SlideShowController,
    SlideShowManager,
} from "grapher/slideshowController/SlideShowController"
import { ExplorerContainerId } from "./ExplorerConstants"
import { CountryPickerManager } from "grapher/controls/countryPicker/CountryPickerConstants"
import { SelectionArray, SelectionManager } from "grapher/core/SelectionArray"
import { CoreRow, TableSlug } from "coreTable/CoreTableConstants"
import { OwidTableSlugs } from "coreTable/OwidTableConstants"

export interface SwitcherExplorerProps {
    explorerProgramCode: string
    explorerProgram?: ExplorerProgram
    slug: string
    chartConfigs?: GrapherInterface[]
    bindToWindow?: boolean
    queryString?: string
}

@observer
export class SwitcherExplorer
    extends React.Component<SwitcherExplorerProps>
    implements
        ObservableUrl,
        SlideShowManager,
        CountryPickerManager,
        SelectionManager {
    static bootstrap(props: SwitcherExplorerProps) {
        return ReactDOM.render(
            <SwitcherExplorer
                {...props}
                queryString={window.location.search}
            />,
            document.getElementById(ExplorerContainerId)
        )
    }

    private urlBinding?: UrlBinder

    @computed private get explorerProgram() {
        return (
            this.props.explorerProgram ??
            new ExplorerProgram(
                this.props.slug,
                this.props.explorerProgramCode,
                this.props.queryString
            )
        )
    }

    @observable hideControls = false

    selectionArray = new SelectionArray(this)
    @observable selectedEntityNames = EntityUrlBuilder.queryParamToEntities(
        this.explorerProgram.queryString
    )
    @observable availableEntities = []

    @computed get params(): QueryParams {
        const params: any = {}
        params.hideControls = this.hideControls ? true : undefined
        params.country = EntityUrlBuilder.entitiesToQueryParam(
            this.selectionArray.selectedEntityNames
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
        const { selectionArray } = this
        const currentEntities = selectionArray.availableEntityNameSet
        const missingEntities = this.grapher.availableEntities.filter(
            (entity) => !currentEntities.has(entity.entityName)
        )
        selectionArray.addAvailableEntityNames(missingEntities)
    }

    @computed get grapher() {
        return this.explorerShellRef.current?.grapherRef?.current
    }

    private getTable(tableSlug: TableSlug) {
        const table = this.explorerProgram.getTableCode(tableSlug)
        if (!table) return BlankOwidTable()
        if (table.url) {
            const cached = this.tableCache.get(table.url)
            if (cached) return cached
            this.fetchData(table.url)
            return BlankOwidTable()
        }
        return new OwidTable(table.block).dropEmptyRows()
    }

    private tableCache = new Map<string, OwidTable>()
    @action.bound private async fetchData(path: string) {
        const csv = await fetchText(path)
        this.grapher!.inputTable = new OwidTable(csv).withRequiredColumns()
        this.addEntityOptionsToPickerWhenReady()
        this.tableCache.set(path, this.grapher!.inputTable)
    }

    componentDidMount() {
        // Whenever the chartId changes, update Grapher.
        autorun(() =>
            this.updateGrapher(this.explorerProgram.switcherRuntime.selectedRow)
        )
        exposeInstanceOnWindow(this, "switcherExplorer")
    }

    @action.bound private updateGrapher(selectedRow: CoreRow) {
        const grapher = this.grapher
        if (!grapher) return // todo: can we remove this?
        const { chartId, table } = selectedRow

        if (chartId && grapher.id === chartId) return

        const chartConfig = chartId ? this.chartConfigs.get(chartId)! : {}

        const config: GrapherProgrammaticInterface = {
            ...chartConfig,
            ...selectedRow,
            hideEntityControls: !this.hideControls && !this.isEmbed,
            dropUnchangedUrlParams: false,
            manuallyProvideData: table ? true : undefined,
        }

        grapher.hasError = false
        const queryStr = grapher.id
            ? grapher.queryStr
            : this.explorerProgram.queryString

        if (!grapher.slideShow)
            grapher.slideShow = new SlideShowController(
                this.explorerProgram.switcherRuntime.allOptionsAsQueryStrings(),
                0,
                this
            )

        grapher.setAuthoredVersion(config)
        grapher.updateFromObject(config)
        grapher.inputTable = this.getTable(table)
        grapher.populateFromQueryParams(strToQueryParams(queryStr ?? ""))
        grapher.downloadData()
        this.addEntityOptionsToPickerWhenReady()
        this.bindToWindow()
    }

    @action.bound setSlide(queryString: string) {
        this.explorerProgram.switcherRuntime.setValuesFromQueryString(
            queryString
        )
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

    private get panels() {
        return this.explorerProgram.switcherRuntime.choicesWithAvailability.map(
            (choice) => (
                <ExplorerControlPanel
                    key={choice.title}
                    value={choice.value}
                    title={choice.title}
                    explorerSlug={this.explorerProgram.slug}
                    name={choice.title}
                    options={choice.options}
                    type={choice.type}
                    onChange={(value) => {
                        this.explorerProgram.switcherRuntime.setValue(
                            choice.title,
                            value
                        )
                    }}
                />
            )
        )
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

    @observable.ref explorerShellRef: React.RefObject<
        ExplorerShell
    > = React.createRef()

    render() {
        return (
            <ExplorerShell
                headerElement={this.header}
                selectionArray={this.selectionArray}
                controlPanels={this.panels}
                explorerSlug={this.explorerProgram.slug}
                countryPickerManager={this}
                hideControls={this.hideControls}
                isEmbed={this.isEmbed}
                enableKeyboardShortcuts={!this.isEmbed}
                ref={this.explorerShellRef}
            />
        )
    }
}
