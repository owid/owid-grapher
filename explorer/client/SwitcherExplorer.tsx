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
import { CheckboxOption, ExplorerProgram, TableDef } from "./ExplorerProgram"
import { QueryParams, strToQueryParams } from "utils/client/url"
import { EntityUrlBuilder } from "grapher/core/EntityUrlBuilder"
import { BlankOwidTable, OwidTable } from "coreTable/OwidTable"
import { Grapher, GrapherProgrammaticInterface } from "grapher/core/Grapher"
import {
    exposeInstanceOnWindow,
    fetchText,
    trimObject,
} from "grapher/utils/Util"
import {
    SlideShowController,
    SlideShowManager,
} from "grapher/slideshowController/SlideShowController"
import { ExplorerContainerId } from "./ExplorerConstants"
import { CountryPickerManager } from "grapher/controls/countryPicker/CountryPickerConstants"
import { SelectionArray, SelectionManager } from "grapher/core/SelectionArray"
import {
    ColumnSlug,
    CoreRow,
    SortOrder,
    TableSlug,
} from "coreTable/CoreTableConstants"
import { isNotErrorValue } from "coreTable/ErrorValues"
import { GlobalEntitySelection } from "site/globalEntityControl/GlobalEntitySelection"

export interface SwitcherExplorerProps {
    explorerProgramCode: string
    slug: string
    explorerProgram?: ExplorerProgram
    chartConfigs?: GrapherInterface[]
    bindToWindow?: boolean
    queryString?: string
    isEmbed?: boolean // todo: what specifically does this mean? Does it mean IFF in an iframe? Or does it mean in an iframe OR hoisted?
    globalEntitySelection?: GlobalEntitySelection // todo: use this
}

interface BootstrapProps {
    slug: string
    explorerProgramCode: string
    containerNode: HTMLElement
    isEmbed?: boolean // todo: what specifically does this mean? Does it mean IFF in an iframe? Or does it mean in an iframe OR hoisted?
    queryStr?: string
    globalEntitySelection?: GlobalEntitySelection
    bindToWindow?: boolean
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

    static async createSwitcherExplorerAndRenderToDom(props: BootstrapProps) {
        return ReactDOM.render(
            <SwitcherExplorer
                explorerProgramCode={props.explorerProgramCode}
                slug={props.slug}
                queryString={props.queryStr}
                isEmbed={props.isEmbed}
                globalEntitySelection={props.globalEntitySelection}
                bindToWindow={props.bindToWindow}
            />,
            props.containerNode
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
    @observable countryPickerMetric?: ColumnSlug =
        strToQueryParams(this.explorerProgram.queryString ?? "").pickerMetric ??
        undefined
    @observable countryPickerSort?: SortOrder =
        (strToQueryParams(this.explorerProgram.queryString ?? "")
            .pickerSort as SortOrder) ?? undefined

    selectionArray = new SelectionArray(this)
    @observable selectedEntityNames = EntityUrlBuilder.queryParamToEntities(
        strToQueryParams(this.explorerProgram.queryString ?? "").country ?? ""
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

    @observable.ref grapher?: Grapher

    private getTable(tableSlug: TableSlug) {
        const table = this.explorerProgram.getTableDef(tableSlug)
        if (!table) return BlankOwidTable()
        if (table.url) {
            const cached = this.tableCache.get(table.url)
            if (cached) return cached
            this.fetchTable(table)
            return BlankOwidTable()
        }
        return new OwidTable(table.inlineData, table.columnDefinitions, {
            tableDescription: `Loaded from inline data`,
        }).dropEmptyRows()
    }

    private tableCache = new Map<string, OwidTable>()
    @action.bound private async fetchTable(table: TableDef) {
        const path = table.url!
        const csv = await fetchText(path)
        this.grapher!.inputTable = new OwidTable(csv, table.columnDefinitions, {
            tableDescription: `Loaded from ${path}`,
        })
        this.addEntityOptionsToPickerWhenReady()
        this.tableCache.set(path, this.grapher!.inputTable)
    }

    @action.bound setGrapher(grapher: Grapher) {
        this.grapher = grapher
    }

    componentDidMount() {
        this.setGrapher(this.explorerShellRef.current!.grapherRef!.current!)
        // Whenever the selected row changes, update Grapher.
        autorun(() =>
            this.updateGrapher(this.explorerProgram.switcherRuntime.selectedRow)
        )
        exposeInstanceOnWindow(this, "switcherExplorer")
    }

    @action.bound private updateGrapher(selectedRow: CoreRow) {
        const grapher = this.grapher
        if (!grapher) return // todo: can we remove this?
        const { chartId, table } = selectedRow
        const hasChartId = isNotErrorValue(chartId)

        if (hasChartId && grapher.id === chartId) return

        const queryStr = grapher.id
            ? grapher.queryStr
            : this.explorerProgram.queryString

        if (!grapher.slideShow)
            grapher.slideShow = new SlideShowController(
                this.explorerProgram.switcherRuntime.allOptionsAsQueryStrings(),
                0,
                this
            )

        const chartConfig = hasChartId ? this.chartConfigs.get(chartId)! : {}

        // Trim empty properties. Prevents things like clearing "type" which crashes Grapher. The call to grapher.reset will automatically clear things like title, subtitle, if not set.
        const trimmedRow = trimObject(selectedRow, true)

        const config: GrapherProgrammaticInterface = {
            ...chartConfig,
            ...trimmedRow,
            hideEntityControls: !this.hideControls && !this.isEmbed,
            dropUnchangedUrlParams: false,
            manuallyProvideData: table ? true : false,
        }

        if (selectedRow.yScaleToggle === CheckboxOption.true)
            grapher.yAxis.canChangeScaleType = true
        else if (selectedRow.yScaleToggle === CheckboxOption.false)
            grapher.yAxis.canChangeScaleType = false

        grapher.hasError = false

        grapher.setAuthoredVersion(config)
        grapher.reset()
        grapher.updateFromObject(config)
        grapher.inputTable = this.getTable(table)
        grapher.populateFromQueryParams(strToQueryParams(queryStr ?? ""))
        grapher.downloadData()
        if (!hasChartId) grapher.id = 0
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
        return this.props.isEmbed ?? false
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

    @computed get countryPickerTable() {
        return this.grapher?.table
    }

    @computed get pickerColumnSlugs() {
        return this.grapher?.table.columnSlugs ?? []
    }

    @computed get requiredColumnSlugs() {
        return this.grapher?.newSlugs ?? []
    }
}
