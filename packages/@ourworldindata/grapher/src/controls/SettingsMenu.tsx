import * as React from "react"
import { computed, action, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
import classnames from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faGear } from "@fortawesome/free-solid-svg-icons"
import {
    EntityName,
    GRAPHER_CHART_TYPES,
    FacetStrategy,
    GrapherChartType,
} from "@ourworldindata/types"
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
import { OverlayHeader } from "@ourworldindata/components"
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
    isLineChartThatTurnedIntoDiscreteBar?: boolean

    // linear/log scales
    yAxis: AxisConfig
    xAxis: AxisConfig

    // TODO: show intermediate scatterplot points
    compareEndPointsOnly?: boolean
}

interface SettingsMenuProps {
    manager: SettingsMenuManager
    top: number
    bottom: number
    right: number
}

@observer
export class SettingsMenu extends React.Component<SettingsMenuProps> {
    @observable.ref active: boolean = false
    contentRef: React.RefObject<HTMLDivElement> = React.createRef() // the menu contents & backdrop

    constructor(props: SettingsMenuProps) {
        super(props)
        makeObservable(this)
    }

    static shouldShow(manager: SettingsMenuManager): boolean {
        const test = new SettingsMenu({ manager, top: 0, bottom: 0, right: 0 })
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
            ].includes(this.chartType as any)
        )
            return false // We currently do not have these charts with log scale
        if (this.manager.isLineChartThatTurnedIntoDiscreteBar) return false
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

    @action.bound private onDocumentKeyDown(e: KeyboardEvent): void {
        // dismiss menu on esc
        if (this.active && e.key === "Escape") this.toggleVisibility()
    }

    @action.bound private onDocumentClick(e: MouseEvent): void {
        if (
            this.active &&
            this.contentRef?.current &&
            isTargetOutsideElement(e.target!, this.contentRef.current)
        )
            this.toggleVisibility()
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

    @computed private get layout(): {
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

    @computed private get menu(): JSX.Element | void {
        if (this.active) {
            return this.menuContents
        }
    }

    @computed private get menuContents(): JSX.Element {
        const { chartTypeLabel } = this

        const menuTitle = `${chartTypeLabel} settings`

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
                        {this.menuContentsChart}
                    </div>
                </div>
            </div>
        )
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
                {this.menu}
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

interface SettingsGroupProps {
    title: string
    subtitle?: string
    active?: boolean
    children?: React.ReactNode
}

@observer
class SettingsGroup extends React.Component<SettingsGroupProps> {
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
