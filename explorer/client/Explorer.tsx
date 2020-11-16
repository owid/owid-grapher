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
import { ExplorerProgram } from "./ExplorerProgram"
import { SerializedGridProgram } from "explorer/gridLang/SerializedGridProgram"
import { strToQueryParams } from "utils/client/url"
import { EntityUrlBuilder } from "grapher/core/EntityUrlBuilder"
import { Grapher, GrapherProgrammaticInterface } from "grapher/core/Grapher"
import { exposeInstanceOnWindow, throttle } from "grapher/utils/Util"
import {
    SlideShowController,
    SlideShowManager,
} from "grapher/slideshowController/SlideShowController"
import { ExplorerContainerId } from "./ExplorerConstants"
import { EntityPickerManager } from "grapher/controls/entityPicker/EntityPickerConstants"
import { SelectionArray } from "grapher/selection/SelectionArray"
import { ColumnSlug, SortOrder, TableSlug } from "coreTable/CoreTableConstants"
import { isNotErrorValue } from "coreTable/ErrorValues"
import { GlobalEntitySelection } from "grapher/controls/globalEntityControl/GlobalEntitySelection"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faChartLine } from "@fortawesome/free-solid-svg-icons/faChartLine"
import { EntityPicker } from "grapher/controls/entityPicker/EntityPicker"
import classNames from "classnames"
import { GridBoolean } from "explorer/gridLang/GridLangConstants"
import { ColumnTypeNames } from "coreTable/CoreColumnDef"
import { BlankOwidTable, OwidTable } from "coreTable/OwidTable"

export interface ExplorerProps extends SerializedGridProgram {
    explorerProgram?: ExplorerProgram // todo: why do we need this? IIRC it had something to do with speeding up the create page
    grapherConfigs?: GrapherInterface[]
    bindToWindow?: boolean
    queryString?: string
    isEmbed?: boolean // todo: what specifically does this mean? Does it mean IFF in an iframe? Or does it mean in an iframe OR hoisted?
    globalEntitySelection?: GlobalEntitySelection // todo: use this
}

interface ExplorerQueryParams extends GrapherQueryParams {
    pickerSort?: SortOrder
    pickerMetric?: ColumnSlug
}

interface ExplorerGrapherInterface extends GrapherInterface {
    grapherId?: number
    tableSlug?: string
    yScaleToggle?: string
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

    explorerProgram = (
        this.props.explorerProgram ?? ExplorerProgram.fromJson(this.props)
    ).initDecisionMatrix(this.props.queryString)

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

    @computed get grapherConfigs() {
        const arr = this.props.grapherConfigs || []
        const grapherConfigsMap: Map<number, GrapherInterface> = new Map()
        arr.forEach((config) => grapherConfigsMap.set(config.id!, config))
        return grapherConfigsMap
    }

    @observable.ref grapher?: Grapher

    @action.bound setGrapher(grapher: Grapher) {
        this.grapher = grapher
    }

    componentDidMount() {
        this.setGrapher(this.grapherRef!.current!)
        this.updateGrapher()
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

    @action.bound private updateGrapher(
        selectedGrapherRow?: ExplorerGrapherInterface
    ) {
        const grapher = this.grapher
        if (!grapher) return // todo: can we remove this?

        const grapherConfigFromExplorer =
            selectedGrapherRow && Object.keys(selectedGrapherRow).length
                ? selectedGrapherRow
                : this.explorerProgram.tuplesObject

        const { grapherId, tableSlug, yScaleToggle } = grapherConfigFromExplorer

        const hasGrapherId = grapherId && isNotErrorValue(grapherId)

        if (hasGrapherId && grapher.id === grapherId) return

        this.grapherParamsChangedThisSession = {
            ...this.grapherParamsChangedThisSession,
            ...grapher.params,
        }
        const queryStr = grapher.id ? grapher.params : this.initialQueryParams

        if (!grapher.slideShow)
            grapher.slideShow = new SlideShowController(
                this.explorerProgram.decisionMatrix.allOptionsAsQueryStrings(),
                0,
                this
            )

        const grapherConfig =
            grapherId && hasGrapherId ? this.grapherConfigs.get(grapherId)! : {}

        const config: GrapherProgrammaticInterface = {
            ...grapherConfig,
            ...grapherConfigFromExplorer,
            hideEntityControls: this.showExplorerControls,
            manuallyProvideData: tableSlug ? true : false,
        }

        grapher.yAxis.canChangeScaleType = trueFalseOrDefault(
            yScaleToggle,
            grapher.yAxis.canChangeScaleType
        )

        grapher.hasError = false

        grapher.setAuthoredVersion(config)
        grapher.reset()
        grapher.updateFromObject(config)
        this.setTableBySlug(tableSlug) // Set a table immediately, even if a BlankTable
        this.fetchTableAndStoreInCache(tableSlug) // Fetch a remote table in the background, if any.
        grapher.populateFromQueryParams(queryStr)
        grapher.downloadData()
        if (!hasGrapherId) grapher.id = 0
    }

    @action.bound private setTableBySlug(tableSlug?: TableSlug) {
        const grapher = this.grapher!
        grapher.inputTable = this.getTableForSlug(tableSlug)
        grapher.appendNewEntitySelectionOptions()
    }

    private getTableForSlug(tableSlug?: TableSlug) {
        const tableDef = this.explorerProgram.getTableDef(tableSlug)
        if (!tableDef)
            return BlankOwidTable(
                tableSlug,
                `TableDef not found for '${tableSlug}'.`
            )
        if (tableDef.url)
            return (
                Explorer.fetchedTableCache.get(tableDef.url) ??
                BlankOwidTable(tableSlug, `Loading from ${tableDef.url}.`)
            )
        return new OwidTable(tableDef.inlineData, tableDef.columnDefinitions, {
            tableDescription: `Loaded '${tableSlug}' from inline data`,
            tableSlug: tableSlug,
        }).dropEmptyRows()
    }

    private static fetchedTableCache = new Map<string, OwidTable>()
    @action.bound private async fetchTableAndStoreInCache(
        tableSlug?: TableSlug
    ) {
        const url = this.explorerProgram.getUrlForTableSlug(tableSlug)
        if (!url || Explorer.fetchedTableCache.has(url)) return

        const table = await this.explorerProgram.fetchTableForTableSlugIfItHasUrl(
            tableSlug
        )
        if (!table) return
        Explorer.fetchedTableCache.set(url, table)
        this.setTableBySlug(tableSlug)
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

    @computed get params(): ExplorerQueryParams {
        if (!this.grapher) return {}

        return {
            ...this.grapherParamsChangedThisSession,
            ...this.grapher.params,
            ...this.explorerProgram.decisionMatrix.params,
            selection: this.selectionArray.asParam,
            pickerSort: this.entityPickerSort,
            pickerMetric: this.entityPickerMetric,
        }
    }

    /**
     * The complicated code here is for situations like the below:
     *
     * 1. User lands on page and is shown line chart
     * 2. User clicks map tab.
     * 3. User clicks a radio that takes them to a chart where the default tab is map tab.
     * 4. tab=map should still be in URL, even though the default in #3 is map tab.
     * 5. So if user clicks a radio to go back to #2, it should bring them back to map tab.
     *
     * To accomplish this, we need to maintain a little state containing all the url params that have changed during this user's session.
     */
    private grapherParamsChangedThisSession: ExplorerQueryParams = {}

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
                    {this.explorerProgram.explorerTitle}
                </div>
                <div
                    className="ExplorerSubtitle"
                    dangerouslySetInnerHTML={{
                        __html: this.explorerProgram.explorerSubtitle || "",
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

    // todo: add tests for this and better tests for this class in general
    @computed private get showHeaderElement() {
        return (
            this.showExplorerControls &&
            this.explorerProgram.explorerTitle &&
            this.panels.length > 0
        )
    }

    render() {
        const { showExplorerControls, showHeaderElement } = this
        return (
            <div
                className={classNames({
                    Explorer: true,
                    "mobile-explorer": this.isMobile,
                    HideControls: !showExplorerControls,
                    "is-embed": this.props.isEmbed,
                })}
            >
                {showHeaderElement && this.renderHeaderElement()}
                {showHeaderElement && this.renderControlBar()}
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
        if (this.explorerProgram.pickerColumnSlugs)
            return this.explorerProgram.pickerColumnSlugs
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

const trueFalseOrDefault = (val: any, defaultValue: any) =>
    val === GridBoolean.true || val === true
        ? true
        : val === GridBoolean.false
        ? false
        : defaultValue
