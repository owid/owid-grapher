import cx from "classnames"
import { useCallback, useMemo, useState } from "react"
import { Tippy } from "@ourworldindata/utils"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons"
import { Tabs, TabList, Tab, TabPanel } from "react-aria-components"
import { GrapherTrendArrow } from "@ourworldindata/components"
import { CountryData, PARAMETER_KEYS, ParameterKey } from "../helpers/types"
import {
    useSimulation,
    computeStabilizedOverrides,
    type Simulation,
} from "../helpers/useSimulation"
import { ResponsivePopulationChart } from "./PopulationChart.js"
import { ResponsiveDemographyParameterEditor } from "./DemographyParameterEditor.js"
import { ResponsivePopulationPyramid } from "./PopulationPyramid.js"
import { ResponsivePopulationPyramidHorizontal } from "./PopulationPyramidHorizontal.js"
import { TimeSlider } from "../../../../components/TimeSlider/TimeSlider.js"
import {
    START_YEAR,
    END_YEAR,
    HISTORICAL_END_YEAR,
    CONTROL_YEARS,
    FULL_TIME_RANGE,
    BENCHMARK_LINE_COLOR,
    USER_MODIFIED_COLOR,
} from "../helpers/constants.js"
import { PopulationChartLegend } from "./PopulationChartLegend.js"
import { parameterConfigByKey } from "../helpers/parameterConfigs.js"
import { useTippyContainer } from "../../../../hooks/useTippyContainer.js"
import { GRAY_60 } from "@ourworldindata/grapher/src/color/ColorConstants.js"

const PARAMETER_TAB_LABELS: Record<ParameterKey, string> = {
    fertilityRate: "Fertility Rate",
    lifeExpectancy: "Life Expectancy",
    netMigrationRate: "Net Migration",
}

export function SimulationContent({
    data,
    focusParameter,
    stabilizingParameter,
    hidePopulationPyramid,
}: {
    data: CountryData
    focusParameter?: ParameterKey
    stabilizingParameter?: ParameterKey
    hidePopulationPyramid?: boolean
}) {
    const [year, setYear] = useState(END_YEAR)

    const stabilizedOverrides = useMemo(
        () =>
            stabilizingParameter
                ? computeStabilizedOverrides(data, stabilizingParameter)
                : undefined,
        [data, stabilizingParameter]
    )

    const simulation = useSimulation(data, stabilizedOverrides)

    if (!simulation) return null

    const hasUserChanges = simulation.activePreset !== "unwpp"
    const pyramidBarColor =
        hasUserChanges && year > HISTORICAL_END_YEAR
            ? USER_MODIFIED_COLOR
            : undefined

    return (
        <div className="chart-content">
            <div className="container container-left">
                <h3 className="container__title">
                    <span className="container__step">①</span> Change these
                    future assumptions
                </h3>
                <div className="input-panels">
                    <Tabs
                        className="input-tabs"
                        defaultSelectedKey={focusParameter ?? "fertilityRate"}
                    >
                        <TabList className="input-tabs__list">
                            {PARAMETER_KEYS.map((key) => (
                                <Tab
                                    key={key}
                                    id={key}
                                    className="input-tabs__tab"
                                >
                                    {PARAMETER_TAB_LABELS[key]}
                                </Tab>
                            ))}
                        </TabList>
                        {PARAMETER_KEYS.map((key) => {
                            const isWorldMigration =
                                key === "netMigrationRate" &&
                                data.country === "World"
                            const isMuted =
                                (focusParameter && focusParameter !== key) ||
                                isWorldMigration
                            const isNonInteractive =
                                (focusParameter && focusParameter !== key) ||
                                isWorldMigration
                            return (
                                <TabPanel
                                    key={key}
                                    id={key}
                                    className="input-tabs__panel"
                                >
                                    <InputChartPanel
                                        simulation={simulation}
                                        variant={key}
                                        interactive={!isNonInteractive}
                                        lineColor={
                                            isMuted
                                                ? BENCHMARK_LINE_COLOR
                                                : undefined
                                        }
                                        labelColor={
                                            isMuted ? GRAY_60 : undefined
                                        }
                                        resetTarget={stabilizedOverrides?.[key]}
                                        hideInfoIcon={isWorldMigration}
                                        showProjectionLabel
                                        className={cx({
                                            "chart-panel--focus":
                                                focusParameter &&
                                                focusParameter === key,
                                            "chart-panel--muted": isMuted,
                                        })}
                                    />
                                </TabPanel>
                            )
                        })}
                    </Tabs>
                </div>
                <AssumptionsTable simulation={simulation} />
            </div>
            <div className="container container-right">
                <h3 className="container__title">
                    <span className="container__step">②</span> See how they
                    affect population projections
                </h3>
                <div className="output-panels">
                    <ChartPanel
                        className="population-panel"
                        title="Population"
                        subtitle="Historical estimates and projections of total population"
                        header={
                            <PopulationChartLegend
                                modified={hasUserChanges}
                                userTooltip="(to do) This projection is based on the fertility, life expectancy, and migration assumptions you set. Change them in the panel on the left to see how they affect population size. Bla bla, bit of an explanation"
                                benchmarkTooltip="(to do) This is the medium-variant projection from the UN World Population Prospects. Bla bla, bit of an explanation"
                            />
                        }
                    >
                        <ResponsivePopulationChart
                            simulation={simulation}
                            hideChangeAnnotation={!!stabilizingParameter}
                            showHistoricalAnnotation={!!stabilizingParameter}
                        />
                    </ChartPanel>
                    {!hidePopulationPyramid && (
                        <AgeStructurePanel
                            simulation={simulation}
                            year={year}
                            onYearChange={setYear}
                            barColor={pyramidBarColor}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}

function AgeStructurePanel({
    simulation,
    year,
    onYearChange,
    barColor,
}: {
    simulation: Simulation
    year: number
    onYearChange: (year: number) => void
    barColor?: string
}) {
    const title = `Age Structure in ${year}`
    const subtitle = "Population by age and sex"
    const slider = (
        <SimpleYearSlider selectedYear={year} onChange={onYearChange} />
    )
    return (
        <>
            <ChartPanel
                className="pyramid-panel"
                title={title}
                subtitle={subtitle}
                footer={slider}
            >
                <ResponsivePopulationPyramid
                    simulation={simulation}
                    year={year}
                    barColor={barColor}
                />
            </ChartPanel>
            <ChartPanel
                className="age-distribution-panel"
                title={title}
                subtitle={subtitle}
                header={slider}
            >
                <ResponsivePopulationPyramidHorizontal
                    simulation={simulation}
                    year={year}
                    barColor={barColor}
                />
            </ChartPanel>
        </>
    )
}

export function InputChartPanel({
    simulation,
    variant,
    className,
    interactive = true,
    lineColor,
    labelColor,
    hideInfoIcon = false,
    resetTarget,
    showProjectionLabel,
}: {
    simulation: Simulation
    variant: ParameterKey
    className?: string
    interactive?: boolean
    lineColor?: string
    labelColor?: string
    hideInfoIcon?: boolean
    resetTarget?: Record<number, number>
    showProjectionLabel?: boolean
}) {
    const {
        title,
        subtitle: getSubtitle,
        tooltipContent,
    } = parameterConfigByKey[variant]
    const subtitle = getSubtitle(simulation.data.country)
    const isWorldMigration =
        variant === "netMigrationRate" && simulation.data.country === "World"
    const isParameterModified = simulation.modifiedParameters.has(variant)

    // Reset target: explicit override (e.g. stabilized params), or UN WPP defaults
    const effectiveResetTarget =
        resetTarget ?? simulation.unwppScenarioParams[variant]

    const hasResetButton =
        interactive &&
        Object.keys(effectiveResetTarget).some(
            (k) =>
                simulation.scenarioParams[variant][Number(k)] !==
                effectiveResetTarget[Number(k)]
        )

    const handleReset = useCallback(() => {
        simulation.setScenarioParams({
            ...simulation.scenarioParams,
            [variant]: { ...effectiveResetTarget },
        })
    }, [simulation, variant, effectiveResetTarget])

    return (
        <ChartPanel
            className={cx(className, {
                "chart-panel--italic-subtitle": isWorldMigration,
            })}
            title={title}
            subtitle={subtitle}
            tooltipContent={hideInfoIcon ? undefined : tooltipContent}
            onReset={hasResetButton ? handleReset : undefined}
            header={
                interactive ? (
                    <PopulationChartLegend
                        userLabel="Your assumptions"
                        benchmarkLabel="UN WPP assumptions"
                        modified={isParameterModified}
                    />
                ) : undefined
            }
        >
            <ResponsiveDemographyParameterEditor
                simulation={simulation}
                variant={variant}
                interactive={interactive}
                lineColor={lineColor}
                projectionColor={
                    !lineColor && isParameterModified
                        ? USER_MODIFIED_COLOR
                        : undefined
                }
                labelColor={labelColor}
                showProjectionLabel={showProjectionLabel}
            />
        </ChartPanel>
    )
}

export function ChartPanel({
    title,
    titleSuffix,
    subtitle,
    tooltipContent,
    subheader,
    children,
    header,
    footer,
    className,
    onReset,
}: {
    title: string
    titleSuffix?: React.ReactNode
    subtitle: string
    tooltipContent?: string
    subheader?: React.ReactNode
    children?: React.ReactNode
    header?: React.ReactNode
    footer?: React.ReactNode
    className?: string
    onReset?: () => void
}) {
    const { ref: panelRef, getTippyContainer } =
        useTippyContainer<HTMLDivElement>()

    return (
        <div ref={panelRef} className={cx("chart-panel", className)}>
            {onReset && (
                <button className="chart-panel__reset-btn" onClick={onReset}>
                    Reset
                </button>
            )}
            <h3 className="chart-panel__title">
                {title}
                {titleSuffix}
            </h3>
            <p className="chart-panel__subtitle">
                {subtitle}
                {tooltipContent && (
                    <span style={{ whiteSpace: "nowrap" }}>
                        {"\u00a0"}
                        <Tippy
                            content={tooltipContent}
                            placement="top"
                            appendTo={getTippyContainer}
                        >
                            <span className="chart-panel__info-icon">
                                <FontAwesomeIcon
                                    icon={faCircleInfo}
                                    size="sm"
                                />
                            </span>
                        </Tippy>
                    </span>
                )}
            </p>
            {subheader && (
                <div className="chart-panel__subheader">{subheader}</div>
            )}
            {header && <div className="chart-panel__header">{header}</div>}
            {children && <div className="chart-panel__content">{children}</div>}
            {footer && <div className="chart-panel__footer">{footer}</div>}
        </div>
    )
}

function AssumptionsTable({ simulation }: { simulation: Simulation }) {
    const { ref: tableRef, getTippyContainer } =
        useTippyContainer<HTMLTableElement>()
    return (
        <table className="assumptions-table" ref={tableRef}>
            <colgroup>
                <col className="assumptions-table__col-year" />
                <col />
                <col />
                <col />
            </colgroup>
            <thead>
                <tr>
                    <th></th>
                    {PARAMETER_KEYS.map((key) => {
                        return (
                            <th key={key}>
                                {PARAMETER_TAB_LABELS[key]}
                                <Tippy
                                    content={
                                        parameterConfigByKey[key].tooltipContent
                                    }
                                    placement="top"
                                    appendTo={getTippyContainer}
                                >
                                    <span className="assumptions-table__info-icon">
                                        <FontAwesomeIcon
                                            icon={faCircleInfo}
                                            size="sm"
                                        />
                                    </span>
                                </Tippy>
                            </th>
                        )
                    })}
                </tr>
            </thead>
            <tbody>
                {CONTROL_YEARS.map((yr) => (
                    <tr key={yr}>
                        <td className="assumptions-table__year">In {yr}</td>
                        {PARAMETER_KEYS.map((key) => {
                            const config = parameterConfigByKey[key]
                            const unit =
                                key === "lifeExpectancy"
                                    ? " years"
                                    : key === "fertilityRate"
                                      ? " births"
                                      : ""
                            const userVal = simulation.scenarioParams[key][yr]
                            const refVal =
                                simulation.unwppScenarioParams[key][yr]
                            const isModified =
                                Math.abs(userVal - refVal) >= 0.01
                            const direction =
                                userVal > refVal ? "up" : ("down" as const)
                            return (
                                <td
                                    key={key}
                                    className={
                                        isModified
                                            ? "assumptions-table__value--modified"
                                            : "assumptions-table__value--default"
                                    }
                                >
                                    {isModified ? (
                                        <>
                                            <span className="assumptions-table__ref-value">
                                                {config.formatValue(refVal)}
                                            </span>
                                            <span className="assumptions-table__arrow-circle">
                                                <GrapherTrendArrow
                                                    direction={direction}
                                                    isColored={false}
                                                    className="assumptions-table__arrow"
                                                />
                                            </span>
                                            {config.formatValue(userVal)}
                                            {unit}
                                        </>
                                    ) : (
                                        <>
                                            {config.formatValue(refVal)}
                                            {unit}
                                        </>
                                    )}
                                </td>
                            )
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

function SimpleYearSlider({
    selectedYear,
    onChange,
}: {
    selectedYear: number
    onChange: (year: number) => void
}) {
    return (
        <div className="demography-year-slider">
            <span className="demography-year-slider__label">{START_YEAR}</span>
            <TimeSlider
                times={FULL_TIME_RANGE}
                selectedTime={selectedYear}
                onChange={onChange}
                showEdgeLabels={false}
            />
            <span className="demography-year-slider__label">{END_YEAR}</span>
        </div>
    )
}
