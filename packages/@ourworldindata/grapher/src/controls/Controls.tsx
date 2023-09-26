import React from "react"
import Select from "react-select"
import { createPortal } from "react-dom"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faXmark,
    faGear,
    faInfoCircle,
    faPencilAlt,
    faEye,
    faRightLeft,
} from "@fortawesome/free-solid-svg-icons"
import { EntityName } from "@ourworldindata/core-table"
import { SelectionArray } from "../selection/SelectionArray"
import { ChartDimension } from "../chart/ChartDimension"
import {
    GRAPHER_SETTINGS_DRAWER_ID,
    ChartTypeName,
    FacetAxisDomain,
    FacetStrategy,
    StackMode,
    ScaleType,
} from "../core/GrapherConstants"
import { MapConfig } from "../mapCharts/MapConfig"
import {
    MapProjectionName,
    MapProjectionLabels,
} from "../mapCharts/MapProjections"
import { AxisConfig } from "../axis/AxisConfig"
import { Tippy, range } from "@ourworldindata/utils"
import classnames from "classnames"

const {
    LineChart,
    ScatterPlot,
    StackedArea,
    StackedDiscreteBar,
    StackedBar,
    Marimekko,
} = ChartTypeName

export type ControlsManager = EntitySelectionManager &
    MapProjectionMenuManager &
    SettingsMenuManager

export interface EntitySelectionManager {
    showSelectEntitiesButton?: boolean
    showChangeEntityButton?: boolean
    showAddEntityButton?: boolean
    entityType?: string
    entityTypePlural?: string
    isSelectingData?: boolean
    isOnTableTab?: boolean
    isOnMapTab?: boolean
}

@observer
export class EntitySelectorToggle extends React.Component<{
    manager: EntitySelectionManager
}> {
    render(): JSX.Element | null {
        const {
            showSelectEntitiesButton,
            showChangeEntityButton,
            showAddEntityButton,
            entityType,
            entityTypePlural,
            isSelectingData: active,
            isOnTableTab,
            isOnMapTab,
        } = this.props.manager

        if (isOnMapTab || isOnTableTab) return null

        const [icon, label] = showSelectEntitiesButton
            ? [faEye, `Select ${entityTypePlural}`]
            : showChangeEntityButton
            ? [faRightLeft, `Change ${entityType}`]
            : showAddEntityButton
            ? [faPencilAlt, `Edit ${entityTypePlural}`]
            : []

        return icon && label ? (
            <div className="entity-selection-menu">
                <button
                    className={classnames("menu-toggle", { active })}
                    onClick={(): void => {
                        this.props.manager.isSelectingData = !active
                    }}
                >
                    <FontAwesomeIcon icon={icon} /> {label}
                </button>
            </div>
        ) : null
    }
}

export interface SettingsMenuManager {
    showConfigurationDrawer?: boolean

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
    type: ChartTypeName
    isRelativeMode?: boolean
    selection?: SelectionArray | EntityName[]
    filledDimensions: ChartDimension[]
    xColumnSlug?: string
    xOverrideTime?: number
    hasTimeline?: boolean
    canToggleRelativeMode: boolean
    isOnMapTab?: boolean

    // linear/log & align-faceted-axes
    yAxis: AxisConfig
    xAxis: AxisConfig

    // zoom-to-selection
    zoomToSelection?: boolean

    // show no-data entities in marimekko
    showNoDataArea?: boolean

    // facet by
    availableFacetStrategies: FacetStrategy[]
    facetStrategy?: FacetStrategy
    entityType?: string
    facettingLabelByYVariables?: string

    // absolute/relative units
    stackMode?: StackMode
    relativeToggleLabel?: string

    // show intermediate scatterplot points
    compareEndPointsOnly?: boolean

    // use entity selection from chart to filter table rows
    isOnTableTab?: boolean
    showSelectionOnlyInDataTable?: boolean
}

@observer
export class SettingsMenu extends React.Component<{
    manager: SettingsMenuManager
    top: number
    bottom: number
}> {
    @observable.ref active: boolean = false // set to true when the menu's display has been requested
    @observable.ref visible: boolean = false // true while menu is active and during enter/exit transitions

    @computed get showYScaleToggle(): boolean | undefined {
        if (this.manager.hideYScaleToggle) return false
        if (this.manager.isRelativeMode) return false
        if ([StackedArea, StackedBar].includes(this.manager.type)) return false // We currently do not have these charts with log scale
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
            this.manager.type !== StackedDiscreteBar
        )
    }

    @computed get showZoomToggle(): boolean {
        // TODO:
        // grapher passes a SelectionArray instance but programmatically defined
        // managers treat `selection` as a string[] of entity names. do we need both?
        const { selection, type, hideZoomToggle } = this.manager,
            entities =
                selection instanceof SelectionArray
                    ? selection.selectedEntityNames
                    : Array.isArray(selection)
                    ? selection
                    : []

        return !hideZoomToggle && type === ScatterPlot && entities.length > 0
    }

    @computed get showNoDataAreaToggle(): boolean {
        return (
            !this.manager.hideNoDataAreaToggle &&
            this.manager.type === Marimekko &&
            this.manager.xColumnSlug !== undefined
        )
    }

    @computed get showAbsRelToggle(): boolean {
        const { type, canToggleRelativeMode, hasTimeline, xOverrideTime } =
            this.manager
        if (!canToggleRelativeMode) return false
        if (type === ScatterPlot)
            return xOverrideTime === undefined && !!hasTimeline
        return [
            StackedArea,
            StackedBar,
            StackedDiscreteBar,
            ScatterPlot,
            LineChart,
            Marimekko,
        ].includes(type)
    }

    @computed get showFacetControl(): boolean {
        const {
            filledDimensions,
            availableFacetStrategies,
            hideFacetControl,
            isOnTableTab,
            type,
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
        ].includes(type)

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

    @computed get showSettingsMenuToggle(): boolean {
        if (this.manager.isOnMapTab) return false
        if (this.manager.isOnTableTab) return true

        return !!(
            this.showYScaleToggle ||
            this.showXScaleToggle ||
            this.showFacetYDomainToggle ||
            this.showZoomToggle ||
            this.showNoDataAreaToggle ||
            this.showFacetControl ||
            this.showAbsRelToggle
        )

        // TODO: add a showCompareEndPointsOnlyTogggle to complement compareEndPointsOnly
    }

    @action.bound toggleVisibility(e: React.MouseEvent): void {
        this.active = !this.active
        if (this.active) this.visible = true
        this.drawer?.classList.toggle("active", this.active)
        e.stopPropagation()
    }

    @action.bound onAnimationEnd(): void {
        if (!this.active) this.visible = false
    }

    @computed get manager(): SettingsMenuManager {
        return this.props.manager
    }

    @computed get chartType(): string {
        const { type } = this.manager
        return type.replace(/([A-Z])/g, " $1")
    }

    @computed get drawer(): Element | null {
        return document.querySelector(`nav#${GRAPHER_SETTINGS_DRAWER_ID}`)
    }

    @computed get layout(): { maxHeight: string; top: number } | void {
        // constrain height only in the pop-up case (drawers are full-height)
        if (!this.drawer) {
            const { top, bottom } = this.props,
                maxHeight = `calc(100% - ${top + bottom}px)`
            return { maxHeight, top }
        }
    }

    private animationFor(selector: string): { animation: string } {
        const phase = this.active ? "enter" : "exit",
            timing = this.drawer ? "333ms" : "0"
        return { animation: `${selector}-${phase} ${timing}` }
    }

    @computed get menu(): JSX.Element | void {
        const { visible, drawer } = this

        if (visible) {
            return !drawer
                ? this.menuContents
                : createPortal(this.menuContents, drawer)
        }
    }

    @computed get menuContents(): JSX.Element {
        const {
            manager,
            chartType,
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
            compareEndPointsOnly,
            filledDimensions,
            isOnTableTab,
        } = manager

        const yLabel =
                filledDimensions.find((d: ChartDimension) => d.property === "y")
                    ?.display.name ?? "Y axis",
            xLabel =
                filledDimensions.find((d: ChartDimension) => d.property === "x")
                    ?.display.name ?? "X axis",
            omitLoneAxisLabel =
                showYScaleToggle && !showXScaleToggle && yLabel === "Y axis"

        const menuTitle = `${isOnTableTab ? "Table" : chartType} settings`

        return (
            <div className="settings-menu-contents">
                <div
                    className="settings-menu-backdrop"
                    onClick={this.toggleVisibility}
                    style={this.animationFor("settings-menu-backdrop")}
                    onAnimationEnd={this.onAnimationEnd} // triggers unmount
                ></div>
                <div
                    className="settings-menu-controls"
                    style={{
                        ...this.animationFor("settings-menu-controls"),
                        ...this.layout,
                    }}
                >
                    <div className="config-header">
                        <div className="config-title">{menuTitle}</div>
                        <button
                            className="clickable close"
                            onClick={this.toggleVisibility}
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </div>

                    <Setting
                        title="Chart view"
                        active={
                            showAbsRelToggle ||
                            showZoomToggle ||
                            showNoDataAreaToggle ||
                            showFacetControl ||
                            showFacetYDomainToggle
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
                    </Setting>

                    <Setting title="Data rows" active={isOnTableTab}>
                        <TableFilterToggle manager={manager} />
                    </Setting>

                    <Setting
                        title="Axis scale"
                        active={showYScaleToggle || showXScaleToggle}
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
                            Linear scales use absolute differences in data
                            values to position points. Logarithmic scales use
                            percentage differences to determine the distance
                            between points.
                        </div>
                    </Setting>

                    <Setting
                        title="Data series"
                        // info="Include all intermediate points or show only the start and end values."
                        active={compareEndPointsOnly}
                    ></Setting>
                </div>
            </div>
        )
    }

    render(): JSX.Element | null {
        const { showSettingsMenuToggle, active } = this
        return showSettingsMenuToggle ? (
            <div className="settings-menu">
                <button
                    className={classnames("menu-toggle", { active })}
                    onClick={this.toggleVisibility}
                >
                    <FontAwesomeIcon icon={faGear} />
                    <span className="label"> Settings</span>
                </button>
                {this.menu}
            </div>
        ) : null
    }
}

@observer
export class Setting extends React.Component<{
    title: string
    subtitle?: string
    active?: boolean
    children?: React.ReactNode
}> {
    render(): JSX.Element | null {
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

@observer
export class LabeledSwitch extends React.Component<{
    value?: boolean
    label?: string
    tooltip?: string
    onToggle: () => any
}> {
    render(): JSX.Element {
        const { label, value, tooltip } = this.props

        return (
            <div className="config-switch">
                <label>
                    <input
                        type="checkbox"
                        checked={value}
                        onChange={this.props.onToggle}
                    />
                    <div className="outer">
                        <div className="inner"></div>
                    </div>
                    {label}
                    {tooltip && (
                        <Tippy
                            content={tooltip}
                            theme="settings"
                            placement="top"
                            // arrow={false}
                            maxWidth={338}
                        >
                            <FontAwesomeIcon icon={faInfoCircle} />
                        </Tippy>
                    )}
                </label>
            </div>
        )
    }
}

@observer
export class AxisScaleToggle extends React.Component<{
    axis: AxisConfig
    subtitle?: string
    prefix?: string
}> {
    @action.bound private setAxisScale(scale: ScaleType): void {
        this.props.axis.scaleType = scale
    }

    render(): JSX.Element {
        const { linear, log } = ScaleType,
            { axis, prefix, subtitle } = this.props,
            isLinear = axis.scaleType === linear,
            label = prefix ? `${prefix}: ` : undefined

        return (
            <>
                <div className="config-toggle">
                    {subtitle && <label>{subtitle}</label>}
                    <button
                        className={classnames({ active: isLinear })}
                        onClick={(): void => this.setAxisScale(linear)}
                    >
                        {label}Linear
                    </button>
                    <button
                        className={classnames({ active: !isLinear })}
                        onClick={(): void => this.setAxisScale(log)}
                    >
                        {label}Logarithmic
                    </button>
                </div>
            </>
        )
    }
}

export interface NoDataAreaToggleManager {
    showNoDataArea?: boolean
}

@observer
export class NoDataAreaToggle extends React.Component<{
    manager: NoDataAreaToggleManager
}> {
    @action.bound onToggle(): void {
        this.manager.showNoDataArea = !this.manager.showNoDataArea
    }

    @computed get manager(): NoDataAreaToggleManager {
        return this.props.manager
    }

    render(): JSX.Element {
        return (
            <LabeledSwitch
                label={"Show \u2018no data\u2019 area"}
                value={this.manager.showNoDataArea}
                tooltip="Include entities for which ‘no data’ is available in the chart."
                onToggle={this.onToggle}
            />
        )
    }
}
export interface AbsRelToggleManager {
    stackMode?: StackMode
    relativeToggleLabel?: string
}

@observer
export class AbsRelToggle extends React.Component<{
    manager: AbsRelToggleManager
}> {
    @action.bound onToggle(): void {
        this.manager.stackMode = this.isRelativeMode
            ? StackMode.absolute
            : StackMode.relative
    }

    @computed get isRelativeMode(): boolean {
        return this.manager.stackMode === StackMode.relative
    }

    @computed get manager(): AbsRelToggleManager {
        return this.props.manager
    }

    render(): JSX.Element {
        const label =
            this.manager.relativeToggleLabel ?? "Display relative values"
        return (
            <LabeledSwitch
                label={label}
                value={this.isRelativeMode}
                tooltip="Show proportional changes over time or actual values in their original units."
                onToggle={this.onToggle}
            />
        )
    }
}

export interface FacetYDomainToggleManager {
    facetStrategy?: FacetStrategy
    yAxis?: AxisConfig
}

@observer
export class FacetYDomainToggle extends React.Component<{
    manager: FacetYDomainToggleManager
}> {
    @action.bound onToggle(): void {
        this.props.manager.yAxis!.facetDomain = this.isYDomainShared
            ? FacetAxisDomain.independent
            : FacetAxisDomain.shared
    }

    @computed get isYDomainShared(): boolean {
        const facetDomain =
            this.props.manager.yAxis!.facetDomain || FacetAxisDomain.shared
        return facetDomain === FacetAxisDomain.shared
    }

    render(): JSX.Element | null {
        if (this.props.manager.facetStrategy === "none") return null
        return (
            <LabeledSwitch
                label="Align axis scales"
                tooltip="Use the same minimum and maximum values on all charts or scale axes to fit the data in each chart"
                value={this.isYDomainShared}
                onToggle={this.onToggle}
            />
        )
    }
}

export interface ZoomToggleManager {
    zoomToSelection?: boolean
}

@observer
export class ZoomToggle extends React.Component<{
    manager: ZoomToggleManager
}> {
    @action.bound onToggle(): void {
        this.props.manager.zoomToSelection = this.props.manager.zoomToSelection
            ? undefined
            : true
    }

    render(): JSX.Element {
        return (
            <LabeledSwitch
                label="Zoom to selection"
                tooltip="Scale axes to show only the currently highlighted data points."
                value={this.props.manager.zoomToSelection}
                onToggle={this.onToggle}
            />
        )
    }
}

export interface TableFilterToggleManager {
    showSelectionOnlyInDataTable?: boolean
    entityTypePlural?: string
}

@observer
export class TableFilterToggle extends React.Component<{
    manager: TableFilterToggleManager
}> {
    @action.bound onToggle(): void {
        const { manager } = this.props
        manager.showSelectionOnlyInDataTable =
            manager.showSelectionOnlyInDataTable ? undefined : true
    }

    render(): JSX.Element {
        const tooltip = `Only display table rows for ${
            this.props.manager.entityTypePlural ?? "countries or regions"
        } selected within the chart`

        return (
            <LabeledSwitch
                label="Show selection only"
                tooltip={tooltip}
                value={this.props.manager.showSelectionOnlyInDataTable}
                onToggle={this.onToggle}
            />
        )
    }
}

export interface FacetStrategySelectionManager {
    availableFacetStrategies: FacetStrategy[]
    facetStrategy?: FacetStrategy
    entityType?: string
    facettingLabelByYVariables?: string
}

@observer
export class FacetStrategySelector extends React.Component<{
    manager: FacetStrategySelectionManager
}> {
    @computed get facetStrategyLabels(): { [key in FacetStrategy]: string } {
        return {
            [FacetStrategy.none]: "All together",
            [FacetStrategy.entity]: `Split by ${this.entityName}`,
            [FacetStrategy.metric]: `Split by ${this.metricName}`,
        }
    }

    @computed get entityName(): string {
        return this.props.manager.entityType ?? "country or region"
    }

    @computed get metricName(): string {
        return this.props.manager.facettingLabelByYVariables ?? "metric"
    }

    @computed get strategies(): FacetStrategy[] {
        return (
            this.props.manager.availableFacetStrategies || [
                FacetStrategy.none,
                FacetStrategy.entity,
                FacetStrategy.metric,
            ]
        )
    }

    @computed get subtitle(): string {
        const entityChoice = this.entityName.replace(/ or /, "/"),
            byEntity = this.strategies.includes(FacetStrategy.entity),
            byMetric = this.strategies.includes(FacetStrategy.metric)

        if (byEntity || byMetric) {
            const facet =
                byEntity && byMetric
                    ? `${this.metricName} or ${entityChoice}`
                    : byEntity
                    ? this.entityName
                    : this.metricName
            return (
                "Visualize the data all together in one chart or split it by " +
                facet
            )
        } else {
            return ""
        }
    }

    render(): JSX.Element {
        return (
            <>
                <div className="config-subtitle">{this.subtitle}</div>
                <div className="config-list">
                    {this.strategies.map((value: FacetStrategy) => {
                        const label = this.facetStrategyLabels[value],
                            active = value === this.facetStrategy,
                            option = value.toString()

                        return (
                            <button
                                key={option}
                                className={classnames(option, { active })}
                                onClick={(): void => {
                                    this.props.manager.facetStrategy = value
                                }}
                            >
                                <div className="faceting-icon">
                                    {range(value === "none" ? 1 : 6).map(
                                        (i) => (
                                            <span key={i}></span>
                                        )
                                    )}
                                </div>
                                {label}
                            </button>
                        )
                    })}
                </div>
            </>
        )
    }

    @computed get facetStrategy(): FacetStrategy {
        return this.props.manager.facetStrategy || FacetStrategy.none
    }
}

export interface MapProjectionMenuManager {
    mapConfig?: MapConfig
    isOnMapTab?: boolean
}

interface MapProjectionMenuItem {
    label: string
    value: MapProjectionName
}

@observer
export class MapProjectionMenu extends React.Component<{
    manager: MapProjectionMenuManager
}> {
    @action.bound onChange(selected: MapProjectionMenuItem | null): void {
        const { mapConfig } = this.props.manager
        if (selected && mapConfig) mapConfig.projection = selected.value
    }

    @computed get options(): { value: MapProjectionName; label: string }[] {
        return Object.values(MapProjectionName).map((projectName) => {
            return {
                value: projectName,
                label: MapProjectionLabels[projectName],
            }
        })
    }

    render(): JSX.Element | null {
        const { isOnMapTab } = this.props.manager,
            { projection } = this.props.manager.mapConfig ?? {}

        return isOnMapTab && projection ? (
            <div className="map-projection-menu">
                <Select
                    options={this.options}
                    onChange={this.onChange}
                    value={this.options.find((opt) => projection === opt.value)}
                    menuPlacement="bottom"
                    components={{
                        IndicatorSeparator: null,
                        DropdownIndicator: null,
                    }}
                    isSearchable={false}
                    unstyled={true}
                    isMulti={false}
                    classNames={{
                        control: (state) =>
                            state.menuIsOpen ? "active control" : "control",
                        option: (state) =>
                            state.isSelected ? "active option" : "option",
                        menu: () => "menu",
                    }}
                />
            </div>
        ) : null
    }
}
