import cx from "classnames"
import { useCallback, useMemo, useState } from "react"
import { useBreakpoint } from "../helpers/useBreakpoint.js"
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
import { PopulationChart } from "./PopulationChart.js"
import { DemographyParameterEditor } from "./DemographyParameterEditor.js"
import { PopulationPyramid } from "./PopulationPyramid.js"
import { PopulationPyramidHorizontal } from "./PopulationPyramidHorizontal.js"
import { TimeSlider } from "../../../../components/TimeSlider/TimeSlider.js"
import {
    START_YEAR,
    END_YEAR,
    HISTORICAL_END_YEAR,
    CONTROL_YEARS,
    FULL_TIME_RANGE,
    USER_MODIFIED_COLOR,
    USER_MODIFIED_COLOR_LIGHT,
} from "../helpers/constants.js"
import { ProjectionLegend } from "./ProjectionLegend.js"
import { parameterConfigByKey } from "../helpers/parameterConfigs.js"
import { useTippyContainer } from "../../../../hooks/useTippyContainer.js"

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
    populationPyramidUnit,
}: {
    data: CountryData
    focusParameter?: ParameterKey
    stabilizingParameter?: ParameterKey
    hidePopulationPyramid?: boolean
    populationPyramidUnit?: "percent" | "absolute"
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

    const isWorld = data.country === "World"
    const visibleParameterKeys = isWorld
        ? PARAMETER_KEYS.filter((k) => k !== "netMigrationRate")
        : PARAMETER_KEYS

    const hasUserChanges = simulation.isModified
    const pyramidBarColor =
        hasUserChanges && year > HISTORICAL_END_YEAR
            ? {
                  female: USER_MODIFIED_COLOR_LIGHT,
                  male: USER_MODIFIED_COLOR,
              }
            : undefined

    return (
        <div
            className={cx("chart-content", {
                "chart-content--no-pyramid": hidePopulationPyramid,
            })}
        >
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
                            {visibleParameterKeys.map((key) => (
                                <Tab
                                    key={key}
                                    id={key}
                                    className="input-tabs__tab"
                                >
                                    {PARAMETER_TAB_LABELS[key]}
                                </Tab>
                            ))}
                        </TabList>
                        {visibleParameterKeys.map((key) => (
                            <TabPanel
                                key={key}
                                id={key}
                                className="input-tabs__panel"
                            >
                                <InputChartPanel
                                    simulation={simulation}
                                    variant={key}
                                    resetTarget={stabilizedOverrides?.[key]}
                                    showProjectionLabel
                                />
                            </TabPanel>
                        ))}
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
                            <ProjectionLegend
                                modified={hasUserChanges}
                                userTooltip="This projection is based on the fertility, life expectancy, and migration assumptions you set. Change them in the panel on the left to see how they affect population projections."
                            />
                        }
                    >
                        <PopulationChart
                            simulation={simulation}
                            showHistoricalAnnotation={!!stabilizingParameter}
                        />
                    </ChartPanel>
                    {!hidePopulationPyramid && (
                        <AgeStructurePanel
                            simulation={simulation}
                            year={year}
                            onYearChange={setYear}
                            barColor={pyramidBarColor}
                            populationPyramidUnit={populationPyramidUnit}
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
    populationPyramidUnit,
}: {
    simulation: Simulation
    year: number
    onYearChange: (year: number) => void
    barColor?: { female: string; male: string } | string
    populationPyramidUnit?: "percent" | "absolute"
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
                <PopulationPyramid
                    simulation={simulation}
                    year={year}
                    barColor={barColor}
                    unit={populationPyramidUnit}
                />
            </ChartPanel>
            <ChartPanel
                className="age-distribution-panel"
                title={title}
                subtitle={subtitle}
                header={slider}
            >
                <PopulationPyramidHorizontal
                    simulation={simulation}
                    year={year}
                    barColor={barColor}
                    unit={populationPyramidUnit}
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
    hideInfoIcon = false,
    resetTarget,
    showProjectionLabel,
    showLegend = interactive,
    maxGridLines,
    yMin,
}: {
    simulation: Simulation
    variant: ParameterKey
    className?: string
    interactive?: boolean
    hideInfoIcon?: boolean
    resetTarget?: Record<number, number>
    showProjectionLabel?: boolean
    showLegend?: boolean
    maxGridLines?: number
    yMin?: number
}) {
    const {
        title,
        subtitle: getSubtitle,
        tooltipContent,
    } = parameterConfigByKey[variant]
    const subtitle = getSubtitle(simulation.data.country)

    const isParameterModified = simulation.modifiedParameters.has(variant)

    // Reset target: explicit override (e.g. stabilized params), or UN WPP defaults
    const effectiveResetTarget =
        resetTarget ?? simulation.unwppScenarioParams[variant]

    const isModifiedFromResetTarget = Object.keys(effectiveResetTarget).some(
        (k) =>
            simulation.scenarioParams[variant][Number(k)] !==
            effectiveResetTarget[Number(k)]
    )
    const hasResetButton = interactive && isModifiedFromResetTarget

    const handleReset = useCallback(() => {
        simulation.setScenarioParams({
            ...simulation.scenarioParams,
            [variant]: { ...effectiveResetTarget },
        })
    }, [simulation, variant, effectiveResetTarget])

    return (
        <ChartPanel
            className={className}
            title={title}
            subtitle={subtitle}
            tooltipContent={hideInfoIcon ? undefined : tooltipContent}
            onReset={hasResetButton ? handleReset : undefined}
            header={
                showLegend ? (
                    <ProjectionLegend
                        userLabel="Your assumptions"
                        benchmarkLabel="UN WPP assumptions"
                        modified={isParameterModified}
                    />
                ) : undefined
            }
        >
            <DemographyParameterEditor
                simulation={simulation}
                variant={variant}
                interactive={interactive}
                showProjectionLabel={showProjectionLabel}
                maxGridLines={maxGridLines}
                yMin={yMin}
            />
        </ChartPanel>
    )
}

export function ChartPanel({
    title,
    subtitle,
    tooltipContent,
    children,
    header,
    footer,
    className,
    onReset,
}: {
    title: string
    subtitle: string
    tooltipContent?: string
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
            <h3 className="chart-panel__title">{title}</h3>
            <p className="chart-panel__subtitle">
                {subtitle}
                {tooltipContent && (
                    <span className="nowrap">
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
            {header && <div className="chart-panel__header">{header}</div>}
            {children && <div className="chart-panel__content">{children}</div>}
            {footer && <div className="chart-panel__footer">{footer}</div>}
        </div>
    )
}

function AssumptionsTable({ simulation }: { simulation: Simulation }) {
    const breakpoint = useBreakpoint()
    const useShortTitles =
        breakpoint === "small" ||
        breakpoint === "narrow" ||
        breakpoint === "medium"
    const isWorld = simulation.data.country === "World"
    const visibleKeys = isWorld
        ? PARAMETER_KEYS.filter((k) => k !== "netMigrationRate")
        : PARAMETER_KEYS
    const { ref: tableRef, getTippyContainer } =
        useTippyContainer<HTMLTableElement>()
    return (
        <table className="assumptions-table" ref={tableRef}>
            <colgroup>
                <col className="assumptions-table__col-year" />
                {visibleKeys.map((key) => (
                    <col key={key} />
                ))}
            </colgroup>
            <thead>
                <tr>
                    <th></th>
                    {visibleKeys.map((key) => {
                        return (
                            <th key={key}>
                                {useShortTitles
                                    ? parameterConfigByKey[key].extraShortTitle
                                    : PARAMETER_TAB_LABELS[key]}
                                <span style={{ whiteSpace: "nowrap" }}>
                                    {"\u00a0"}
                                    <Tippy
                                        content={
                                            parameterConfigByKey[key]
                                                .tooltipContent
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
                                </span>
                            </th>
                        )
                    })}
                </tr>
            </thead>
            <tbody>
                {CONTROL_YEARS.map((yr) => (
                    <tr key={yr}>
                        <td className="assumptions-table__year">In {yr}</td>
                        {visibleKeys.map((key) => {
                            const config = parameterConfigByKey[key]
                            const unit = useShortTitles
                                ? ""
                                : key === "lifeExpectancy"
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
                                            <span
                                                className="assumptions-table__ref-value"
                                                style={{ whiteSpace: "nowrap" }}
                                            >
                                                {config.formatValue(refVal)}
                                            </span>
                                            <span
                                                style={{ whiteSpace: "nowrap" }}
                                            >
                                                <span className="assumptions-table__arrow-circle">
                                                    <GrapherTrendArrow
                                                        direction={direction}
                                                        isColored={false}
                                                        className="assumptions-table__arrow"
                                                    />
                                                </span>
                                                {config.formatValue(userVal)}
                                                {unit}
                                            </span>
                                        </>
                                    ) : (
                                        <span style={{ whiteSpace: "nowrap" }}>
                                            {config.formatValue(refVal)}
                                            {unit}
                                        </span>
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
