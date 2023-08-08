import React from "react"
import { createPortal } from "react-dom"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faXmark,
    faGear,
    faInfoCircle,
    faPencilAlt,
    // faEye,
    faRightLeft,
} from "@fortawesome/free-solid-svg-icons"
import {
    GRAPHER_SETTINGS_DRAWER_ID,
    ChartTypeName,
    FacetAxisDomain,
    FacetStrategy,
    StackMode,
    ScaleType,
} from "../core/GrapherConstants"
import { AxisConfig } from "../axis/AxisConfig"
import { Tippy, range } from "@ourworldindata/utils"
import classnames from "classnames"

export interface EntitySelectionManager {
    showSelectEntitiesButton?: boolean
    showChangeEntityButton?: boolean
    entityType?: string
    entityTypePlural?: string
    isSelectingData?: boolean
}

@observer
export class EntitySelectorToggle extends React.Component<{
    manager: EntitySelectionManager
}> {
    render(): JSX.Element | null {
        const {
            showSelectEntitiesButton,
            showChangeEntityButton,
            entityType,
            entityTypePlural,
            isSelectingData: active,
        } = this.props.manager

        if (!(showSelectEntitiesButton || showChangeEntityButton)) return null

        const [icon, label] = showSelectEntitiesButton
            ? [faPencilAlt, `Select ${entityTypePlural}`]
            : [faRightLeft, `Change ${entityType}`]

        return (
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
        )
    }
}

export interface SettingsMenuManager {
    showConfigurationDrawer?: boolean

    // linear/log & align-faceted-axes
    showYScaleToggle?: boolean
    showXScaleToggle?: boolean
    showFacetYDomainToggle?: boolean
    yAxis?: AxisConfig
    xAxis?: AxisConfig

    // zoom-to-selection
    showZoomToggle?: boolean
    zoomToSelection?: boolean

    // show no-data entities in marimekko
    showNoDataAreaToggle?: boolean
    showNoDataArea?: boolean

    // facet by
    showFacetControl?: boolean
    availableFacetStrategies: FacetStrategy[]
    facetStrategy?: FacetStrategy
    entityType?: string
    facettingLabelByYVariables?: string

    // absolute/relative units
    showAbsRelToggle?: boolean
    stackMode?: StackMode
    relativeToggleLabel?: string

    // show intermediate scatterplot points
    compareEndPointsOnly?: boolean
}

@observer
export class SettingsMenu extends React.Component<{
    manager: SettingsMenuManager
    top: number
    bottom: number
    chart: ChartTypeName
}> {
    @observable.ref visible: boolean = false
    @observable.ref shouldRender: boolean = false

    @action.bound toggleVisibility(): void {
        this.visible = !this.visible
        if (this.visible) this.shouldRender = true
        this.drawer?.classList.toggle("active", this.visible)
    }

    @action.bound onAnimationEnd(): void {
        if (!this.visible) this.shouldRender = false
    }

    @computed get manager(): SettingsMenuManager {
        return this.props.manager
    }

    @computed get chartType(): string {
        const { chart } = this.props
        return chart.replace(/([A-Z])/g, " $1")
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
        const phase = this.visible ? "enter" : "exit",
            timing = this.drawer ? "333ms" : "0"
        return { animation: `${selector}-${phase} ${timing}` }
    }

    @computed get menu(): JSX.Element | void {
        const { shouldRender, drawer } = this

        if (shouldRender) {
            return !drawer
                ? this.menuContents
                : createPortal(this.menuContents, drawer)
        }
    }

    @computed get menuContents(): JSX.Element {
        const { manager, chartType } = this

        const {
            showYScaleToggle,
            showXScaleToggle,
            yAxis,
            xAxis,
            showZoomToggle,
            showNoDataAreaToggle,
            showFacetControl,
            showAbsRelToggle,
            compareEndPointsOnly,
        } = manager

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
                        <div className="config-title">{chartType} settings</div>
                        <button
                            className="clickable close"
                            onClick={this.toggleVisibility}
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </div>

                    <Setting
                        title="Chart view"
                        info="Visualize the data all together in one chart or split it by country, region or metric."
                        active={showFacetControl}
                    >
                        <FacetStrategySelector manager={manager} />
                        <FacetYDomainToggle manager={manager} />
                    </Setting>

                    <Setting
                        title="Zoom to selection"
                        info="Crop out any non-selected points."
                        active={showZoomToggle}
                    >
                        <ZoomToggle manager={manager} />
                    </Setting>

                    <Setting
                        title="Show ‘no data’ regions"
                        info="Show all items, including ones for which there is no data."
                        active={showNoDataAreaToggle}
                    >
                        <NoDataAreaToggle manager={manager} />
                    </Setting>

                    <Setting
                        title="Proportional values"
                        info="Display each value in terms of its share of the total."
                        active={showAbsRelToggle}
                    >
                        <AbsRelToggle manager={manager} />
                    </Setting>

                    <Setting
                        title="Data series"
                        info="Include all intermediate points or show only the start and end values."
                        active={compareEndPointsOnly}
                    ></Setting>

                    <Setting
                        title="Y axis scale"
                        info="Linear scales show absolute differences between values, Log scales show percentage differences."
                        active={showYScaleToggle}
                    >
                        <AxisScaleToggle axis={yAxis!} />
                    </Setting>

                    <Setting
                        title="X axis scale"
                        info="Linear scales show absolute differences between values, Log scales show percentage differences."
                        active={showXScaleToggle}
                    >
                        <AxisScaleToggle axis={xAxis!} />
                    </Setting>
                </div>
            </div>
        )
    }

    render(): JSX.Element {
        const { visible: active } = this
        return (
            <div className="settings-menu">
                <button
                    className={classnames("menu-toggle", { active })}
                    onClick={this.toggleVisibility}
                >
                    <FontAwesomeIcon icon={faGear} /> Settings
                </button>
                {this.menu}
            </div>
        )
    }
}

@observer
export class Setting extends React.Component<{
    title: string
    subtitle?: string
    info?: string
    active?: boolean
    children?: React.ReactNode
}> {
    @observable.ref showInfo = false

    @action.bound
    toggleInfo(): void {
        this.showInfo = !this.showInfo
    }

    render(): JSX.Element | null {
        const { active, title, subtitle, info, children } = this.props
        if (!active) return null

        return (
            <section>
                <div className="config-name">
                    {title}
                    {info && (
                        <Tippy
                            content={info}
                            theme="settings"
                            placement="top"
                            // arrow={false}
                            maxWidth={338}
                        >
                            <FontAwesomeIcon icon={faInfoCircle} />
                        </Tippy>
                    )}
                </div>
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
    onToggle: () => any
}> {
    render(): JSX.Element {
        const { label, value } = this.props

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
                </label>
            </div>
        )
    }
}

@observer
export class AxisScaleToggle extends React.Component<{
    axis: AxisConfig
    prefix?: string
}> {
    @action.bound private setAxisScale(scale: ScaleType): void {
        this.props.axis.scaleType = scale
    }

    render(): JSX.Element {
        const { linear, log } = ScaleType,
            { axis, prefix } = this.props,
            isLinear = axis.scaleType === linear,
            label = prefix ? `${prefix}: ` : undefined

        return (
            <div className="config-toggle">
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
        const label = this.manager.relativeToggleLabel ?? "Relative"
        return (
            <LabeledSwitch
                label={label}
                value={this.isRelativeMode}
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
                value={this.props.manager.zoomToSelection}
                onToggle={this.onToggle}
            />
        )
    }
}

export interface FacetStrategySelectionManager {
    availableFacetStrategies: FacetStrategy[]
    facetStrategy?: FacetStrategy
    showFacetControl?: boolean
    entityType?: string
    facettingLabelByYVariables?: string
}

@observer
export class FacetStrategySelector extends React.Component<{
    manager: FacetStrategySelectionManager
}> {
    @computed get facetStrategyLabels(): { [key in FacetStrategy]: string } {
        const entityType = this.props.manager.entityType ?? "country or region"

        const facettingLabelByYVariables =
            this.props.manager.facettingLabelByYVariables ?? "metric"

        return {
            [FacetStrategy.none]: "All together",
            [FacetStrategy.entity]: `Split by ${entityType}`,
            [FacetStrategy.metric]: `Split by ${facettingLabelByYVariables}`,
        }
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

    render(): JSX.Element {
        return (
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
                                {range(value === "none" ? 1 : 6).map((i) => (
                                    <span key={i}></span>
                                ))}
                            </div>
                            {label}
                        </button>
                    )
                })}
            </div>
        )
    }

    @computed get facetStrategy(): FacetStrategy {
        return this.props.manager.facetStrategy || FacetStrategy.none
    }
}
