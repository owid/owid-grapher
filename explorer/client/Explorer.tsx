import React from "react"
import { observer } from "mobx-react"
import { action, observable, computed, autorun } from "mobx"
import { GrapherInterface } from "grapher/core/GrapherInterface"
import {
    ExplorerControlPanel,
    ExplorerControlBar,
} from "explorer/client/ExplorerControls"
import ReactDOM from "react-dom"
import {
    UrlBinder,
    ObservableUrl,
    MultipleUrlBinder,
} from "grapher/utils/UrlBinder"
import { ExplorerProgram, TableDef } from "./ExplorerProgram"
import { QueryParams, strToQueryParams } from "utils/client/url"
import { EntityUrlBuilder } from "grapher/core/EntityUrlBuilder"
import { BlankOwidTable, OwidTable } from "coreTable/OwidTable"
import { Grapher, GrapherProgrammaticInterface } from "grapher/core/Grapher"
import {
    exposeInstanceOnWindow,
    fetchText,
    trimObject,
    throttle,
} from "grapher/utils/Util"
import {
    SlideShowController,
    SlideShowManager,
} from "grapher/slideshowController/SlideShowController"
import { ExplorerContainerId } from "./ExplorerConstants"
import { EntityPickerManager } from "grapher/controls/entityPicker/EntityPickerConstants"
import { SelectionArray } from "grapher/selection/SelectionArray"
import {
    ColumnSlug,
    CoreRow,
    SortOrder,
    TableSlug,
} from "coreTable/CoreTableConstants"
import { isNotErrorValue } from "coreTable/ErrorValues"
import { GlobalEntitySelection } from "grapher/controls/globalEntityControl/GlobalEntitySelection"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faChartLine } from "@fortawesome/free-solid-svg-icons/faChartLine"
import { EntityPicker } from "grapher/controls/entityPicker/EntityPicker"
import classNames from "classnames"
import { GridBoolean } from "./GridGrammarConstants"

export interface ExplorerProps {
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
export class Explorer
    extends React.Component<ExplorerProps>
    implements ObservableUrl, SlideShowManager, EntityPickerManager {
    static bootstrap(props: ExplorerProps) {
        return ReactDOM.render(
            <Explorer {...props} queryString={window.location.search} />,
            document.getElementById(ExplorerContainerId)
        )
    }

    static async createExplorerAndRenderToDom(props: BootstrapProps) {
        return ReactDOM.render(
            <Explorer
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
    @observable entityPickerMetric?: ColumnSlug =
        strToQueryParams(this.explorerProgram.queryString ?? "").pickerMetric ??
        undefined
    @observable entityPickerSort?: SortOrder =
        (strToQueryParams(this.explorerProgram.queryString ?? "")
            .pickerSort as SortOrder) ?? undefined

    selectionArray = new SelectionArray(
        EntityUrlBuilder.queryParamToEntities(
            strToQueryParams(this.explorerProgram.queryString ?? "").country ??
                ""
        )
    )

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
        const grapher = this.grapher!
        grapher.inputTable = new OwidTable(csv, table.columnDefinitions, {
            tableDescription: `Loaded from ${path}`,
        })
        grapher.appendNewEntitySelectionOptions()
        this.tableCache.set(path, grapher.inputTable)
    }

    @action.bound setGrapher(grapher: Grapher) {
        this.grapher = grapher
    }

    componentDidMount() {
        this.setGrapher(this.grapherRef!.current!)
        // Whenever the selected row changes, update Grapher.
        autorun(() =>
            this.updateGrapher(this.explorerProgram.decisionMatrix.selectedRow)
        )
        exposeInstanceOnWindow(this, "explorer")
        this.onResizeThrottled = throttle(this.onResize, 100)
        window.addEventListener("resize", this.onResizeThrottled)
        this.onResize() // call resize for the first time to initialize chart
    }

    componentWillUnmount() {
        if (this.onResizeThrottled)
            window.removeEventListener("resize", this.onResizeThrottled)
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
                this.explorerProgram.decisionMatrix.allOptionsAsQueryStrings(),
                0,
                this
            )

        const chartConfig = hasChartId ? this.chartConfigs.get(chartId)! : {}

        // Trim empty properties. Prevents things like clearing "type" which crashes Grapher. The call to grapher.reset will automatically clear things like title, subtitle, if not set.
        const trimmedRow = trimObject(selectedRow, true)

        const config: GrapherProgrammaticInterface = {
            ...chartConfig,
            ...trimmedRow,
            hideEntityControls: !this.hideControls && !this.props.isEmbed,
            dropUnchangedUrlParams: false,
            manuallyProvideData: table ? true : false,
        }

        if (selectedRow.yScaleToggle === GridBoolean.true)
            grapher.yAxis.canChangeScaleType = true
        else if (selectedRow.yScaleToggle === GridBoolean.false)
            grapher.yAxis.canChangeScaleType = false

        grapher.hasError = false

        grapher.setAuthoredVersion(config)
        grapher.reset()
        grapher.updateFromObject(config)
        grapher.inputTable = this.getTable(table)
        grapher.populateFromQueryParams(strToQueryParams(queryStr ?? ""))
        grapher.downloadData()
        if (!hasChartId) grapher.id = 0
        this.bindToWindow()
    }

    @action.bound setSlide(queryString: string) {
        this.explorerProgram.decisionMatrix.setValuesFromQueryString(
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
                this.explorerProgram.decisionMatrix,
                this,
            ])
        )
    }

    private get panels() {
        return this.explorerProgram.decisionMatrix.choicesWithAvailability.map(
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
                        this.explorerProgram.decisionMatrix.setValue(
                            choice.title,
                            value
                        )
                    }}
                />
            )
        )
    }

    private renderHeaderElement() {
        return (
            <div className="ExplorerHeaderBox">
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
            </div>
        )
    }

    private _isMobile() {
        return (
            window.screen.width < 450 ||
            document.documentElement.clientWidth <= 800
        )
    }

    @observable private isMobile = this._isMobile()

    @computed private get showExplorerControls() {
        return !this.hideControls || !this.props.isEmbed
    }

    @observable private grapherContainerRef: React.RefObject<
        HTMLDivElement
    > = React.createRef()

    @observable.ref private grapherBounds = DEFAULT_BOUNDS
    @observable.ref private grapherRef: React.RefObject<
        Grapher
    > = React.createRef()

    private renderControlBar() {
        return (
            <ExplorerControlBar
                isMobile={this.isMobile}
                showControls={this.showMobileControlsPopup}
                closeControls={this.closeControls}
            >
                {this.panels}
            </ExplorerControlBar>
        )
    }

    private renderEntityPicker() {
        return (
            <EntityPicker
                key="entityPicker"
                manager={this}
                isDropdownMenu={this.isMobile}
            />
        )
    }

    private onResizeThrottled?: () => void

    @action.bound private toggleMobileControls() {
        this.showMobileControlsPopup = !this.showMobileControlsPopup
    }

    @action.bound private onResize() {
        this.isMobile = this._isMobile()
        this.grapherBounds = this.getGrapherBounds() || this.grapherBounds
    }

    // Todo: add better logic to maximize the size of the Grapher
    private getGrapherBounds() {
        const grapherContainer = this.grapherContainerRef.current
        return grapherContainer
            ? new Bounds(
                  0,
                  0,
                  grapherContainer.clientWidth,
                  grapherContainer.clientHeight
              )
            : undefined
    }

    @observable private showMobileControlsPopup = false
    private get mobileCustomizeButton() {
        return (
            <a
                className="btn btn-primary mobile-button"
                onClick={this.toggleMobileControls}
                data-track-note="covid-customize-chart"
            >
                <FontAwesomeIcon icon={faChartLine} /> Customize chart
            </a>
        )
    }

    @action.bound private closeControls() {
        this.showMobileControlsPopup = false
    }

    render() {
        const { showExplorerControls } = this
        return (
            <div
                className={classNames({
                    Explorer: true,
                    "mobile-explorer": this.isMobile,
                    HideControls: !showExplorerControls,
                    "is-embed": this.props.isEmbed,
                })}
            >
                {showExplorerControls && this.renderHeaderElement()}
                {showExplorerControls && this.renderControlBar()}
                {showExplorerControls && this.renderEntityPicker()}
                {showExplorerControls &&
                    this.isMobile &&
                    this.mobileCustomizeButton}
                <div className="ExplorerFigure" ref={this.grapherContainerRef}>
                    <Grapher
                        bounds={this.grapherBounds}
                        isEmbed={true}
                        selectionArray={this.selectionArray}
                        ref={this.grapherRef}
                        enableKeyboardShortcuts={true}
                    />
                </div>
            </div>
        )
    }

    @computed get entityPickerTable() {
        return this.grapher?.table
    }

    @computed get pickerColumnSlugs() {
        return this.grapher?.table.columnSlugs ?? []
    }

    @computed get requiredColumnSlugs() {
        return this.grapher?.newSlugs ?? []
    }
}
