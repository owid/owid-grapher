import * as React from "react"
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
import { SelectionArray } from "../selection/SelectionArray"
import { ChartDimension } from "../chart/ChartDimension"
import { makeSelectionArray } from "../chart/ChartUtils.js"
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
import { Popover } from "../popover/Popover"
import { GRAPHER_SETTINGS_CLASS } from "../core/GrapherConstants"

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
    isOnChartTab?: boolean

    // linear/log scales
    yAxis: AxisConfig
    xAxis: AxisConfig

    // TODO: show intermediate scatterplot points
    compareEndPointsOnly?: boolean
}

@observer
export class SettingsMenu extends React.Component<{
    manager: SettingsMenuManager
    popoverStyle?: React.CSSProperties
}> {
    @observable.ref active: boolean = false

    static shouldShow(manager: SettingsMenuManager): boolean {
        const test = new SettingsMenu({ manager })
        return test.showSettingsMenuToggle
    }

    @computed get chartType(): GrapherChartType {
        return this.manager.activeChartType ?? GRAPHER_CHART_TYPES.LineChart
    }

    @computed get showYScaleToggle(): boolean | undefined {
        if (this.manager.hideYScaleToggle) return false
        if (this.manager.isRelativeMode) return false
        if (
            [
                GRAPHER_CHART_TYPES.StackedArea,
                GRAPHER_CHART_TYPES.StackedBar,
                GRAPHER_CHART_TYPES.DiscreteBar,
                GRAPHER_CHART_TYPES.StackedDiscreteBar,
                GRAPHER_CHART_TYPES.Marimekko,
            ].includes(this.chartType as any)
        )
            return false // We currently do not have these charts with log scale
        return this.manager.yAxis.canChangeScaleType
    }

    @computed private get showXScaleToggle(): boolean | undefined {
        if (this.manager.hideXScaleToggle) return false
        if (this.manager.isRelativeMode) return false
        return this.manager.xAxis.canChangeScaleType
    }

    @computed private get showFacetYDomainToggle(): boolean {
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

    @computed private get showAbsRelToggle(): boolean {
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

    @computed private get showFacetControl(): boolean {
        const {
            filledDimensions,
            availableFacetStrategies,
            hideFacetControl,
            isOnChartTab,
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
            SlopeChart,
        ].includes(this.chartType as any)

        const hasProjection = filledDimensions.some(
            (dim) => dim.display.isProjection
        )

        return (
            showFacetControlChartType &&
            !hideFacetControl &&
            !hasProjection &&
            !!isOnChartTab
        )
    }

    @computed private get showSettingsMenuToggle(): boolean {
        if (!this.manager.isOnChartTab) return false

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

    @action.bound private toggleVisibility(): void {
        this.active = !this.active
    }

    @computed private get manager(): SettingsMenuManager {
        return this.props.manager
    }

    @computed private get chartTypeLabel(): string {
        return this.chartType.replace(/([A-Z])/g, " $1")
    }

    @computed private get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager.selection)
    }

    @computed private get menuContentsChart(): React.ReactElement {
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

    @computed private get menuTitle(): string {
        const { chartTypeLabel } = this
        return `${chartTypeLabel} settings`
    }

    private renderSettingsButtonAndPopup(): JSX.Element {
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
                <Popover
                    title={this.menuTitle}
                    isOpen={this.active}
                    onClose={this.toggleVisibility}
                    className={GRAPHER_SETTINGS_CLASS}
                    style={this.props.popoverStyle}
                >
                    {this.menuContentsChart}
                </Popover>
            </div>
        )
    }

    render(): React.ReactElement | null {
        const {
            manager: { isOnChartTab },
            showSettingsMenuToggle,
        } = this

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
