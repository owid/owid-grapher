import React from "react"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import classnames from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faGear } from "@fortawesome/free-solid-svg-icons"
import {
    EntityName,
    GRAPHER_CHART_TYPES,
    FacetStrategy,
    GrapherChartType,
} from "@ourworldindata/types"
import { DEFAULT_BOUNDS } from "@ourworldindata/utils"
import { SelectionArray } from "../selection/SelectionArray"
import { ChartDimension } from "../chart/ChartDimension"
import {
    isTargetOutsideElement,
    makeSelectionArray,
} from "../chart/ChartUtils.js"
import { AxisConfig } from "../axis/AxisConfig"

import { AxisScaleToggle } from "./settings/AxisScaleToggle"
import { AbsRelToggle, AbsRelToggleManager } from "./settings/AbsRelToggle"
import { ZoomToggle, ZoomToggleManager } from "./settings/ZoomToggle"
import {
    FacetStrategySelector,
    FacetStrategySelectionManager,
} from "./settings/FacetStrategySelector"
import {
    FacetYDomainToggle,
    FacetYDomainToggleManager,
} from "./settings/FacetYDomainToggle"
import {
    NoDataAreaToggle,
    NoDataAreaToggleManager,
} from "./settings/NoDataAreaToggle"
import {
    TableFilterToggle,
    TableFilterToggleManager,
} from "./settings/TableFilterToggle"
import { OverlayHeader } from "@ourworldindata/components"
import {
    DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL,
    GRAPHER_SETTINGS_CLASS,
} from "../core/GrapherConstants"

const {
    LineChart,
    ScatterPlot,
    StackedArea,
    StackedDiscreteBar,
    StackedBar,
    Marimekko,
    SlopeChart,
} = GRAPHER_CHART_TYPES

export interface SettingsMenuManager
    extends AbsRelToggleManager,
        NoDataAreaToggleManager,
        FacetYDomainToggleManager,
        ZoomToggleManager,
        TableFilterToggleManager,
        FacetStrategySelectionManager {
    // ArchieML directives
    hideFacetControl?: boolean
    hideRelativeToggle?: boolean
    hideEntityControls?: boolean
    hideZoomToggle?: boolean
    hideNoDataAreaToggle?: boolean
    hideFacetYDomainToggle?: boolean
    hideXScaleToggle?: boolean
    hideYScaleToggle?: boolean
    hideTableFilterToggle?: boolean

    // chart state
    activeChartType?: GrapherChartType
    isRelativeMode?: boolean
    selection?: SelectionArray | EntityName[]
    canChangeAddOrHighlightEntities?: boolean
    filledDimensions: ChartDimension[]
    xColumnSlug?: string
    xOverrideTime?: number
    hasTimeline?: boolean
    canToggleRelativeMode: boolean
    isOnMapTab?: boolean
    isOnChartTab?: boolean
    isOnTableTab?: boolean

    // linear/log scales
    yAxis: AxisConfig
    xAxis: AxisConfig

    // TODO: show intermediate scatterplot points
    compareEndPointsOnly?: boolean
}

@observer
export class SettingsMenu extends React.Component<{
    manager: SettingsMenuManager
    maxWidth?: number
    top: number
    bottom: number
    right: number
}> {
    @observable.ref active: boolean = false
    contentRef: React.RefObject<HTMLDivElement> = React.createRef() // the menu contents & backdrop

    static shouldShow(manager: SettingsMenuManager): boolean {
        const test = new SettingsMenu({ manager, top: 0, bottom: 0, right: 0 })
        return test.showSettingsMenuToggle
    }

    @computed get chartType(): GrapherChartType {
        return this.manager.activeChartType ?? GRAPHER_CHART_TYPES.LineChart
    }

    @computed get maxWidth(): number {
        return this.props.maxWidth ?? DEFAULT_BOUNDS.width
    }

    @computed get showYScaleToggle(): boolean | undefined {
        if (this.manager.hideYScaleToggle) return false
        if (this.manager.isRelativeMode) return false
        if ([StackedArea, StackedBar].includes(this.chartType as any))
            return false // We currently do not have these charts with log scale
        return this.manager.yAxis.canChangeScaleType
    }

    @computed get showXScaleToggle(): boolean | undefined {
        if (this.manager.hideXScaleToggle) return false
        if (this.manager.isRelativeMode) return false
        return this.manager.xAxis.canChangeScaleType
    }

    @computed get showFacetYDomainToggle(): boolean {
        // don't offer to make the y range relative if the range is discrete
        return (
            !this.manager.hideFacetYDomainToggle &&
            this.manager.facetStrategy !== FacetStrategy.none &&
            this.chartType !== StackedDiscreteBar
        )
    }

    @computed get showZoomToggle(): boolean {
        const { hideZoomToggle } = this.manager
        return (
            !hideZoomToggle &&
            this.chartType === ScatterPlot &&
            this.selectionArray.hasSelection
        )
    }

    @computed get showNoDataAreaToggle(): boolean {
        return (
            !this.manager.hideNoDataAreaToggle &&
            this.chartType === Marimekko &&
            this.manager.xColumnSlug !== undefined
        )
    }

    @computed get showAbsRelToggle(): boolean {
        const { canToggleRelativeMode, hasTimeline, xOverrideTime } =
            this.manager
        if (!canToggleRelativeMode) return false
        if (this.chartType === ScatterPlot)
            return xOverrideTime === undefined && !!hasTimeline
        return [
            StackedArea,
            StackedBar,
            StackedDiscreteBar,
            ScatterPlot,
            LineChart,
            Marimekko,
            SlopeChart,
        ].includes(this.chartType as any)
    }

    @computed get showFacetControl(): boolean {
        const {
            filledDimensions,
            availableFacetStrategies,
            hideFacetControl,
            isOnTableTab,
        } = this.manager

        // if there's no choice to be made, don't display a lone button
        if (availableFacetStrategies.length <= 1) return false

        // heuristic: if the chart doesn't make sense unfaceted, then it probably
        // also makes sense to let the user switch between entity/metric facets
        if (!availableFacetStrategies.includes(FacetStrategy.none)) return true

        const showFacetControlChartType = [
            StackedArea,
            StackedBar,
            StackedDiscreteBar,
            LineChart,
        ].includes(this.chartType as any)

        const hasProjection = filledDimensions.some(
            (dim) => dim.display.isProjection
        )

        return (
            showFacetControlChartType &&
            !hideFacetControl &&
            !hasProjection &&
            !isOnTableTab
        )
    }

    @computed get showTableFilterToggle(): boolean {
        const { hideTableFilterToggle, canChangeAddOrHighlightEntities } =
            this.manager
        return (
            this.selectionArray.hasSelection &&
            !!canChangeAddOrHighlightEntities &&
            !hideTableFilterToggle
        )
    }

    @computed get showSettingsMenuToggle(): boolean {
        if (this.manager.isOnMapTab) return false
        if (this.manager.isOnTableTab) return this.showTableFilterToggle

        return !!(
            this.showYScaleToggle ||
            this.showXScaleToggle ||
            this.showFacetYDomainToggle ||
            this.showZoomToggle ||
            this.showNoDataAreaToggle ||
            this.showFacetControl ||
            this.showAbsRelToggle
        )

        // TODO: add a showCompareEndPointsOnlyToggle to complement compareEndPointsOnly
    }

    componentDidMount(): void {
        document.addEventListener("keydown", this.onDocumentKeyDown)
        document.addEventListener("click", this.onDocumentClick, {
            capture: true,
        })
    }

    componentWillUnmount(): void {
        document.removeEventListener("keydown", this.onDocumentKeyDown)
        document.removeEventListener("click", this.onDocumentClick, {
            capture: true,
        })
    }

    @action.bound onDocumentKeyDown(e: KeyboardEvent): void {
        // dismiss menu on esc
        if (this.active && e.key === "Escape") this.toggleVisibility()
    }

    @action.bound onDocumentClick(e: MouseEvent): void {
        if (
            this.active &&
            this.contentRef?.current &&
            isTargetOutsideElement(e.target!, this.contentRef.current)
        )
            this.toggleVisibility()
    }

    @action.bound toggleVisibility(): void {
        this.active = !this.active
    }

    @computed get manager(): SettingsMenuManager {
        return this.props.manager
    }

    @computed get chartTypeLabel(): string {
        return this.chartType.replace(/([A-Z])/g, " $1")
    }

    @computed get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager.selection)
    }

    @computed get shouldRenderTableControlsIntoPopup(): boolean {
        const tableFilterToggleWidth = TableFilterToggle.width(this.manager)
        return tableFilterToggleWidth > this.maxWidth
    }

    @computed get layout(): {
        maxHeight: string
        maxWidth: string
        top: number
        right: number
    } {
        const { top, bottom, right } = this.props,
            maxHeight = `calc(100% - ${top + bottom}px)`,
            maxWidth = `calc(100% - ${2 * right}px)`
        return { maxHeight, maxWidth, top, right }
    }

    @computed get menuContentsChart(): React.ReactElement {
        const {
            manager,
            showYScaleToggle,
            showXScaleToggle,
            showZoomToggle,
            showNoDataAreaToggle,
            showFacetControl,
            showFacetYDomainToggle,
            showAbsRelToggle,
        } = this

        const {
            yAxis,
            xAxis,
            // compareEndPointsOnly,
            filledDimensions,
            isOnChartTab,
        } = manager

        const yLabel =
                filledDimensions.find((d: ChartDimension) => d.property === "y")
                    ?.display.name ?? "Y axis",
            xLabel =
                filledDimensions.find((d: ChartDimension) => d.property === "x")
                    ?.display.name ?? "X axis",
            omitLoneAxisLabel =
                showYScaleToggle && !showXScaleToggle && yLabel === "Y axis"

        return (
            <>
                <SettingsGroup
                    title="Chart view"
                    active={
                        isOnChartTab &&
                        (showAbsRelToggle ||
                            showZoomToggle ||
                            showNoDataAreaToggle ||
                            showFacetControl ||
                            showFacetYDomainToggle)
                    }
                >
                    {showFacetControl && (
                        <FacetStrategySelector manager={manager} />
                    )}
                    {showFacetYDomainToggle && (
                        <FacetYDomainToggle manager={manager} />
                    )}
                    {showAbsRelToggle && <AbsRelToggle manager={manager} />}
                    {showNoDataAreaToggle && (
                        <NoDataAreaToggle manager={manager} />
                    )}
                    {showZoomToggle && <ZoomToggle manager={manager} />}
                </SettingsGroup>
                <SettingsGroup
                    title="Axis scale"
                    active={
                        isOnChartTab && (showYScaleToggle || showXScaleToggle)
                    }
                >
                    {showYScaleToggle && (
                        <AxisScaleToggle
                            axis={yAxis!}
                            subtitle={omitLoneAxisLabel ? "" : yLabel}
                        />
                    )}
                    {showXScaleToggle && (
                        <AxisScaleToggle axis={xAxis!} subtitle={xLabel} />
                    )}
                    <div className="config-subtitle">
                        A linear scale evenly spaces values, where each
                        increment represents a consistent change. A logarithmic
                        scale uses multiples of the starting value, with each
                        increment representing the same percentage increase.
                    </div>
                </SettingsGroup>
            </>
        )
    }

    @computed get menuContentsTable(): JSX.Element {
        const subtitle = `Only display table rows for ${
            this.manager.entityTypePlural ?? DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL
        } selected within the chart`

        return (
            <SettingsGroup
                title="Filter rows"
                subtitle={subtitle}
                active={true}
            >
                <TableFilterToggle manager={this.manager} />
            </SettingsGroup>
        )
    }

    @computed get menu(): JSX.Element | void {
        if (this.active) {
            return this.menuContents
        }
    }

    @computed get menuContents(): JSX.Element {
        const { manager, chartTypeLabel } = this
        const { isOnTableTab } = manager

        const menuTitle = `${isOnTableTab ? "Table" : chartTypeLabel} settings`

        return (
            <div className={GRAPHER_SETTINGS_CLASS} ref={this.contentRef}>
                <div
                    className="settings-menu-backdrop"
                    onClick={this.toggleVisibility}
                ></div>
                <div
                    className="settings-menu-wrapper"
                    style={{
                        ...this.layout,
                    }}
                >
                    <OverlayHeader
                        className="settings-menu-header"
                        title={menuTitle}
                        onDismiss={this.toggleVisibility}
                    />
                    <div className="settings-menu-controls">
                        {isOnTableTab
                            ? this.menuContentsTable
                            : this.menuContentsChart}
                    </div>
                </div>
            </div>
        )
    }

    renderSettingsButtonAndPopup(): JSX.Element {
        const { active } = this
        return (
            <div className="settings-menu">
                <button
                    className={classnames("menu-toggle", { active })}
                    onClick={this.toggleVisibility}
                    data-track-note="chart_settings_menu_toggle"
                    title="Chart settings"
                    type="button"
                    aria-label="Chart settings"
                >
                    <FontAwesomeIcon icon={faGear} />
                    <span className="label"> Settings</span>
                </button>
                {this.menu}
            </div>
        )
    }

    renderTableControls(): React.ReactElement {
        // Since tables only have a single control, display it inline rather than
        // placing it in the settings menu
        return <TableFilterToggle manager={this.manager} showTooltip={true} />
    }

    render(): React.ReactElement | null {
        const {
            manager: { isOnChartTab, isOnTableTab },
            showSettingsMenuToggle,
            showTableFilterToggle,
        } = this

        if (isOnTableTab && showTableFilterToggle) {
            return this.shouldRenderTableControlsIntoPopup
                ? this.renderSettingsButtonAndPopup()
                : this.renderTableControls()
        }

        return isOnChartTab && showSettingsMenuToggle
            ? this.renderSettingsButtonAndPopup()
            : null
    }
}

@observer
class SettingsGroup extends React.Component<{
    title: string
    subtitle?: string
    active?: boolean
    children?: React.ReactNode
}> {
    render(): React.ReactElement | null {
        const { active, title, subtitle, children } = this.props
        if (!active) return null

        return (
            <section>
                <div className="config-name">{title}</div>
                {subtitle && <div className="config-subtitle">{subtitle}</div>}
                {children}
            </section>
        )
    }
}
