import React from "react"
import { observer } from "mobx-react"
import { action, observable, computed, autorun } from "mobx"
import {
    GrapherInterface,
    GrapherQueryParams,
} from "grapher/core/GrapherInterface"
import {
    ExplorerControlPanel,
    ExplorerControlBar,
} from "explorer/client/ExplorerControls"
import ReactDOM from "react-dom"
import { UrlBinder } from "grapher/utils/UrlBinder"
import {
    ExplorerProgram,
    SerializedExplorerProgram,
    TableDef,
} from "./ExplorerProgram"
import { strToQueryParams } from "utils/client/url"
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
import { ColumnTypeNames } from "coreTable/CoreColumnDef"

export interface ExplorerProps extends SerializedExplorerProgram {
    explorerProgram?: ExplorerProgram // todo: why do we need this? IIRC it had something to do with speeding up the create page
    chartConfigs?: GrapherInterface[]
    bindToWindow?: boolean
    queryString?: string
    isEmbed?: boolean // todo: what specifically does this mean? Does it mean IFF in an iframe? Or does it mean in an iframe OR hoisted?
    globalEntitySelection?: GlobalEntitySelection // todo: use this
}

interface ExplorerQueryParams extends GrapherQueryParams {
    pickerSort?: SortOrder
    pickerMetric?: ColumnSlug
}

@observer
export class Explorer
    extends React.Component<ExplorerProps>
    implements SlideShowManager, EntityPickerManager {
    static bootstrap(props: ExplorerProps) {
        return ReactDOM.render(
            <Explorer {...props} queryString={window.location.search} />,
            document.getElementById(ExplorerContainerId)
        )
    }

    static async createExplorerAndRenderToDom(
        props: ExplorerProps,
        containerNode: HTMLElement
    ) {
        return ReactDOM.render(<Explorer {...props} />, containerNode)
    }

    private urlBinding?: UrlBinder

    @computed private get explorerProgram() {
        const program =
            this.props.explorerProgram ?? ExplorerProgram.fromJson(this.props)
        program.decisionMatrix.setValuesFromQueryString(
            this.props.queryString || program.defaultView
        )
        return program
    }

    private initialQueryParams = strToQueryParams(
        this.props.queryString || this.explorerProgram.defaultView
    ) as ExplorerQueryParams

    @observable entityPickerMetric? = this.initialQueryParams.pickerMetric
    @observable entityPickerSort? = this.initialQueryParams.pickerSort

    selectionArray = new SelectionArray(
        EntityUrlBuilder.queryParamToEntityNames(
            this.initialQueryParams.selection
        ),
        undefined,
        this.explorerProgram.entityType
    )

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
        this.bindToWindow()
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

        const queryStr = grapher.id ? grapher.params : this.initialQueryParams

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
            hideEntityControls: this.showExplorerControls,
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
        grapher.populateFromQueryParams(queryStr)
        grapher.downloadData()
        if (!hasChartId) grapher.id = 0
    }

    @action.bound setSlide(queryString: string) {
        this.explorerProgram.decisionMatrix.setValuesFromQueryString(
            queryString
        )
    }

    bindToWindow() {
        if (!this.props.bindToWindow) return

        this.urlBinding = new UrlBinder()
        this.urlBinding.bindToWindow(this)
    }

    @computed get params() {
        if (!this.grapher) return {}
        const obj: ExplorerQueryParams = {
            ...this.grapher.params,
            ...this.explorerProgram.decisionMatrix.params,
            selection: this.selectionArray.asParam,
        }
        return obj
    }

    @computed get debounceMode() {
        return this.grapher?.debounceMode
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
        if (this.explorerProgram.hideControls) return false

        return this.props.isEmbed ? false : true
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
        const doNotShowThese = new Set([
            ColumnTypeNames.Year,
            ColumnTypeNames.Date,
            ColumnTypeNames.Day,
            ColumnTypeNames.EntityId,
            ColumnTypeNames.EntityCode,
        ])
        return this.grapher?.table.columnsAsArray
            .filter(
                (col) => !doNotShowThese.has(col.def.type as ColumnTypeNames)
            )
            .map((col) => col.slug)
    }

    @computed get requiredColumnSlugs() {
        return this.grapher?.newSlugs ?? []
    }
}
