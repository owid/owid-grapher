import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import React from "react"
import { Grapher } from "grapher/core/Grapher"
import { Command, CommandPalette } from "grapher/controls/CommandPalette"
import { Bounds } from "grapher/utils/Bounds"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faChartLine } from "@fortawesome/free-solid-svg-icons/faChartLine"
import { CountryPicker } from "grapher/controls/CountryPicker"
import { ExplorerControlBar } from "./ExplorerControls"
import classNames from "classnames"
import { GrapherView } from "grapher/core/GrapherView"
import { ExplorerQueryParams } from "./ExplorerProgram"
import { throttle } from "grapher/utils/Util"

// TODO: Migrate CovidExplorer to use this class as well
@observer
export class ExplorerShell extends React.Component<{
    explorerSlug: string
    controlPanels: JSX.Element[]
    grapher: Grapher
    availableEntities: string[]
    headerElement: JSX.Element
    params: ExplorerQueryParams
    isEmbed: boolean
}> {
    get keyboardShortcuts(): Command[] {
        return []
    }

    @computed get showExplorerControls() {
        return !this.props.params.hideControls || !this.props.isEmbed
    }

    @action.bound toggleMobileControls() {
        this.showMobileControlsPopup = !this.showMobileControlsPopup
    }

    @action.bound onResize() {
        this.isMobile = this._isMobile()
        this.chartBounds = this.getChartBounds()
    }

    private _isMobile() {
        return (
            window.screen.width < 450 ||
            document.documentElement.clientWidth <= 800
        )
    }

    @observable private chartContainerRef: React.RefObject<
        HTMLDivElement
    > = React.createRef()

    @observable.ref chartBounds: Bounds | undefined = undefined

    // Todo: add better logic to maximize the size of the chart
    private getChartBounds(): Bounds | undefined {
        const chartContainer = this.chartContainerRef.current
        if (!chartContainer) return undefined
        return new Bounds(
            0,
            0,
            chartContainer.clientWidth,
            chartContainer.clientHeight
        )
    }

    @observable isMobile: boolean = this._isMobile()

    @observable showMobileControlsPopup = false

    get customizeChartMobileButton() {
        return this.isMobile ? (
            <a
                className="btn btn-primary mobile-button"
                onClick={this.toggleMobileControls}
                data-track-note="covid-customize-chart"
            >
                <FontAwesomeIcon icon={faChartLine} /> Customize chart
            </a>
        ) : undefined
    }

    get countryPicker() {
        return (
            <CountryPicker
                explorerSlug={this.props.explorerSlug}
                table={this.props.grapher.table}
                isDropdownMenu={this.isMobile}
                availableEntities={this.props.availableEntities}
                selectedEntities={this.selectedEntityNames}
                clearSelectionCommand={this.clearSelectionCommand}
                toggleCountryCommand={this.toggleSelectedEntityCommand}
            ></CountryPicker>
        )
    }

    @action.bound toggleSelectedEntityCommand(
        entityName: string,
        value?: boolean
    ) {
        const selectedEntities = this.props.params.selectedEntityNames
        if (value) {
            selectedEntities.add(entityName)
        } else if (value === false) {
            selectedEntities.delete(entityName)
        } else if (selectedEntities.has(entityName)) {
            selectedEntities.delete(entityName)
        } else {
            selectedEntities.add(entityName)
        }
    }

    @action.bound clearSelectionCommand() {
        this.props.params.selectedEntityNames.clear()
    }

    @computed get selectedEntityNames(): string[] {
        return Array.from(this.props.params.selectedEntityNames.values())
    }

    get controlBar() {
        return (
            <ExplorerControlBar
                isMobile={this.isMobile}
                showControls={this.showMobileControlsPopup}
                closeControls={this.closeControls}
            >
                {this.props.controlPanels}
            </ExplorerControlBar>
        )
    }

    @action.bound closeControls() {
        this.showMobileControlsPopup = false
    }

    componentDidMount() {
        this.onResizeThrottled = throttle(this.onResize, 100)
        window.addEventListener("resize", this.onResizeThrottled)
        this.onResize()
    }

    componentWillUnmount() {
        if (this.onResizeThrottled) {
            window.removeEventListener("resize", this.onResizeThrottled)
        }
    }

    onResizeThrottled?: () => void

    render() {
        return (
            <>
                <CommandPalette
                    commands={this.keyboardShortcuts}
                    display="none"
                />
                <div
                    className={classNames({
                        CovidExplorer: true,
                        "mobile-explorer": this.isMobile,
                        HideControls: !this.showExplorerControls,
                        "is-embed": this.props.isEmbed
                    })}
                >
                    {this.showExplorerControls && (
                        <div className="ExplorerHeaderBox">
                            {this.props.headerElement}
                        </div>
                    )}
                    {this.showExplorerControls && this.controlBar}
                    {this.showExplorerControls && this.countryPicker}
                    {this.showExplorerControls &&
                        this.customizeChartMobileButton}
                    <div
                        className="CovidExplorerFigure"
                        ref={this.chartContainerRef}
                    >
                        {this.chartBounds && (
                            <GrapherView
                                bounds={this.chartBounds}
                                grapher={this.props.grapher}
                                isEmbed={true}
                            ></GrapherView>
                        )}
                    </div>
                </div>
            </>
        )
    }
}
