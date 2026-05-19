import cx from "classnames"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useBreakpoint } from "../helpers/useBreakpoint.js"
import { Tippy } from "@ourworldindata/utils"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons"
import { Tabs, TabList, Tab, TabPanel } from "react-aria-components"
import { GrapherTrendArrow } from "@ourworldindata/components"
import {
    AgeZone,
    CountryData,
    PARAMETER_KEYS,
    ParameterKey,
} from "../helpers/types"
import {
    useSimulation,
    computeScenarioOverrides,
    type Simulation,
} from "../helpers/useSimulation"
import { updateWindowUrlForSimulationState } from "../helpers/urlState.js"
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
import {
    DependencyRatioLineChart,
    DependencyRatioPyramidBar,
    RelativeAgeStackedAreaChart,
    RetirementAgeEditor,
} from "./DependencyRatioCharts.js"
import {
    defaultRetirementAgePoints,
    getAgeZonesForRetirementAge,
    getRetirementAgeForYear,
    normalizeRetirementAgePoints,
    type RetirementAgePoints,
} from "../helpers/dependencyRatio.js"

const PARAMETER_TAB_LABELS: Record<ParameterKey, string> = {
    fertilityRate: "Fertility rate",
    lifeExpectancy: "Life expectancy",
    netMigrationRate: "Net migration",
}

export function SimulationContent({
    data,
    focusParameter,
    hidePopulationPyramid,
    populationPyramidUnit,
    fertilityRateAssumptions,
    lifeExpectancyAssumptions,
    netMigrationRateAssumptions,
    urlSync,
    urlFertilityRateAssumptions,
    urlLifeExpectancyAssumptions,
    urlNetMigrationRateAssumptions,
    baselineEntityName,
    shouldSyncEntityName = false,
    retirementAgeAssumptions,
    mode = "population",
}: {
    data: CountryData
    focusParameter?: ParameterKey
    hidePopulationPyramid?: boolean
    populationPyramidUnit?: "percent" | "absolute"
    fertilityRateAssumptions?: Record<number, number>
    lifeExpectancyAssumptions?: Record<number, number>
    netMigrationRateAssumptions?: Record<number, number>
    urlSync?: boolean
    urlFertilityRateAssumptions?: Record<number, number>
    urlLifeExpectancyAssumptions?: Record<number, number>
    urlNetMigrationRateAssumptions?: Record<number, number>
    baselineEntityName?: string
    shouldSyncEntityName?: boolean
    retirementAgeAssumptions?: Record<number, number>
    mode?: "population" | "dependencyRatio"
}) {
    const [year, setYear] = useState(END_YEAR)

    const scenarioOverrides = useMemo(
        () =>
            computeScenarioOverrides({
                fertilityRateAssumptions,
                lifeExpectancyAssumptions,
                netMigrationRateAssumptions,
            }),
        [
            fertilityRateAssumptions,
            lifeExpectancyAssumptions,
            netMigrationRateAssumptions,
        ]
    )

    const urlScenarioOverrides = useMemo(
        () =>
            urlSync
                ? computeScenarioOverrides({
                      fertilityRateAssumptions: urlFertilityRateAssumptions,
                      lifeExpectancyAssumptions: urlLifeExpectancyAssumptions,
                      netMigrationRateAssumptions:
                          urlNetMigrationRateAssumptions,
                  })
                : undefined,
        [
            urlSync,
            urlFertilityRateAssumptions,
            urlLifeExpectancyAssumptions,
            urlNetMigrationRateAssumptions,
        ]
    )

    const simulation = useSimulation(
        data,
        scenarioOverrides,
        urlScenarioOverrides
    )
    const scenarioParamsForUrl = simulation?.scenarioParams
    const baselineScenarioParamsForUrl = simulation?.initialScenarioParams

    const [retirementAgePoints, setRetirementAgePoints] =
        useState<RetirementAgePoints>(() =>
            normalizeRetirementAgePoints(retirementAgeAssumptions)
        )
    const defaultRetirementAgePointValues = useMemo(
        () => defaultRetirementAgePoints(),
        []
    )
    const hasRetirementAgeChanges = CONTROL_YEARS.some(
        (controlYear) =>
            retirementAgePoints[controlYear] !==
            defaultRetirementAgePointValues[controlYear]
    )
    const resetRetirementAge = useCallback(() => {
        setRetirementAgePoints(defaultRetirementAgePointValues)
    }, [defaultRetirementAgePointValues])

    useEffect(() => {
        if (!urlSync || !scenarioParamsForUrl || !baselineScenarioParamsForUrl)
            return

        const timeout = window.setTimeout(() => {
            updateWindowUrlForSimulationState({
                entityName: data.country,
                baselineEntityName,
                includeEntityName: shouldSyncEntityName,
                scenarioParams: scenarioParamsForUrl,
                baselineScenarioParams: baselineScenarioParamsForUrl,
            })
        }, 150)

        return () => window.clearTimeout(timeout)
    }, [
        urlSync,
        scenarioParamsForUrl,
        baselineScenarioParamsForUrl,
        data.country,
        baselineEntityName,
        shouldSyncEntityName,
    ])

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
                "chart-content--dependency-ratio": mode === "dependencyRatio",
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
                                <InputTab
                                    key={key}
                                    id={key}
                                    label={PARAMETER_TAB_LABELS[key]}
                                    modified={simulation.modifiedParameters.has(
                                        key
                                    )}
                                />
                            ))}
                            {mode === "dependencyRatio" && (
                                <InputTab
                                    id="retirementAge"
                                    label="Retirement age"
                                    modified={hasRetirementAgeChanges}
                                />
                            )}
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
                                    resetTarget={scenarioOverrides?.[key]}
                                    showProjectionLabel
                                />
                            </TabPanel>
                        ))}
                        {mode === "dependencyRatio" && (
                            <TabPanel
                                id="retirementAge"
                                className="input-tabs__panel"
                            >
                                <RetirementAgeInputPanel
                                    simulation={simulation}
                                    retirementAgePoints={retirementAgePoints}
                                    onChange={setRetirementAgePoints}
                                    onReset={
                                        hasRetirementAgeChanges
                                            ? resetRetirementAge
                                            : undefined
                                    }
                                />
                            </TabPanel>
                        )}
                    </Tabs>
                </div>
                <AssumptionsTable simulation={simulation} />
            </div>
            <div className="container container-right">
                <h3 className="container__title">
                    <span className="container__step">②</span>{" "}
                    {mode === "dependencyRatio"
                        ? "See how they affect the dependency ratio"
                        : "See how they affect population projections"}
                </h3>
                {mode === "dependencyRatio" ? (
                    <DependencyRatioOutputPanels
                        simulation={simulation}
                        year={year}
                        onYearChange={setYear}
                        hidePopulationPyramid={hidePopulationPyramid}
                        barColor={pyramidBarColor}
                        populationPyramidUnit={populationPyramidUnit}
                        retirementAgePoints={retirementAgePoints}
                    />
                ) : (
                    <div className="output-panels">
                        <ChartPanel
                            className="population-panel"
                            title="Population"
                            subtitle="Historical estimates and projections of total population."
                            header={
                                <ProjectionLegend
                                    modified={hasUserChanges}
                                    userTooltip="This projection is based on the fertility, life expectancy, and migration assumptions you set. Change them in the assumptions panel to see how they affect population projections."
                                />
                            }
                        >
                            <PopulationChart simulation={simulation} />
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
                )}
            </div>
        </div>
    )
}

function InputTab({
    id,
    label,
    modified,
}: {
    id: string
    label: string
    modified: boolean
}) {
    return (
        <Tab id={id} className="input-tabs__tab">
            <span
                className={cx("input-tabs__tab-label", {
                    "input-tabs__tab-label--modified": modified,
                })}
            >
                {/* Wrap the last word in a span so the modified dot is positioned
                   next to it even when the label line-breaks. */}
                {label.split(/\s(?=\S+$)/).map((part, i, arr) =>
                    i === arr.length - 1 ? (
                        <span
                            key={i}
                            className="input-tabs__tab-label__last-word"
                        >
                            {part}
                        </span>
                    ) : (
                        part + " "
                    )
                )}
            </span>
        </Tab>
    )
}

function RetirementAgeInputPanel({
    simulation,
    retirementAgePoints,
    onChange,
    onReset,
}: {
    simulation: Simulation
    retirementAgePoints: RetirementAgePoints
    onChange: (points: RetirementAgePoints) => void
    onReset?: () => void
}) {
    return (
        <ChartPanel
            className="retirement-age-panel"
            title="Retirement age"
            subtitle="Set the age from which people are counted as retired. Life expectancy is shown for reference."
            onReset={onReset}
        >
            <RetirementAgeEditor
                simulation={simulation}
                retirementAgePoints={retirementAgePoints}
                onChange={onChange}
            />
        </ChartPanel>
    )
}

function DependencyRatioOutputPanels({
    simulation,
    year,
    onYearChange,
    hidePopulationPyramid,
    barColor,
    populationPyramidUnit,
    retirementAgePoints,
}: {
    simulation: Simulation
    year: number
    onYearChange: (year: number) => void
    hidePopulationPyramid?: boolean
    barColor?: { female: string; male: string } | string
    populationPyramidUnit?: "percent" | "absolute"
    retirementAgePoints: RetirementAgePoints
}) {
    const retirementAge = getRetirementAgeForYear(retirementAgePoints, year)
    const ageZones = getAgeZonesForRetirementAge(retirementAge)
    const pyramidTopBar = (
        <DependencyRatioPyramidBar
            simulation={simulation}
            retirementAgePoints={retirementAgePoints}
            year={year}
        />
    )

    return (
        <div className="output-panels output-panels--dependency-ratio">
            <div className="dependency-panel-column">
                <ChartPanel
                    className="age-share-panel"
                    title="Population by broad age group"
                    subtitle="Share of the population who are young, working age, and retired."
                >
                    <RelativeAgeStackedAreaChart
                        simulation={simulation}
                        retirementAgePoints={retirementAgePoints}
                    />
                </ChartPanel>
                <ChartPanel
                    className="dependency-ratio-panel"
                    title="Dependency ratio"
                >
                    <DependencyRatioLineChart
                        simulation={simulation}
                        retirementAgePoints={retirementAgePoints}
                    />
                </ChartPanel>
            </div>
            {!hidePopulationPyramid && (
                <AgeStructurePanel
                    simulation={simulation}
                    year={year}
                    onYearChange={onYearChange}
                    barColor={barColor}
                    populationPyramidUnit={populationPyramidUnit}
                    ageZones={ageZones}
                    topContent={pyramidTopBar}
                    className="pyramid-panel--dependency-ratio"
                />
            )}
        </div>
    )
}

function AgeStructurePanel({
    simulation,
    year,
    onYearChange,
    barColor,
    populationPyramidUnit,
    ageZones,
    topContent,
    className,
}: {
    simulation: Simulation
    year: number
    onYearChange: (year: number) => void
    barColor?: { female: string; male: string } | string
    populationPyramidUnit?: "percent" | "absolute"
    ageZones?: AgeZone[]
    topContent?: React.ReactNode
    className?: string
}) {
    const title = `Age structure in ${year}`
    const subtitle = "Population by age and sex."
    const slider = (
        <SimpleYearSlider selectedYear={year} onChange={onYearChange} />
    )
    const pyramid = (
        <PyramidWithOptionalTopBar topContent={topContent}>
            <PopulationPyramid
                simulation={simulation}
                year={year}
                barColor={barColor}
                unit={populationPyramidUnit}
                ageZones={ageZones}
                colorBarsByAgeZone={!topContent}
            />
        </PyramidWithOptionalTopBar>
    )
    const horizontalPyramid = (
        <PyramidWithOptionalTopBar topContent={topContent}>
            <PopulationPyramidHorizontal
                simulation={simulation}
                year={year}
                barColor={barColor}
                unit={populationPyramidUnit}
                ageZones={ageZones}
            />
        </PyramidWithOptionalTopBar>
    )

    return (
        <>
            <ChartPanel
                className={cx("pyramid-panel", className, {
                    "pyramid-panel--with-top-bar": topContent,
                })}
                title={title}
                subtitle={subtitle}
                footer={slider}
            >
                {pyramid}
            </ChartPanel>
            <ChartPanel
                className={cx("age-distribution-panel", className, {
                    "pyramid-panel--with-top-bar": topContent,
                })}
                title={title}
                subtitle={subtitle}
                header={slider}
            >
                {horizontalPyramid}
            </ChartPanel>
        </>
    )
}

function PyramidWithOptionalTopBar({
    topContent,
    children,
}: {
    topContent?: React.ReactNode
    children: React.ReactNode
}) {
    if (!topContent) return <>{children}</>

    return (
        <div className="pyramid-panel__content-with-top-bar">
            <div className="pyramid-panel__top-bar">{topContent}</div>
            <div className="pyramid-panel__pyramid">{children}</div>
        </div>
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

    // Reset target: UN WPP defaults, with explicit overrides (e.g. config
    // assumptions) merged on top
    const effectiveResetTarget = useMemo(
        () => ({
            ...simulation.unwppScenarioParams[variant],
            ...resetTarget,
        }),
        [simulation.unwppScenarioParams, variant, resetTarget]
    )

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
                        benchmarkLabel="UN assumptions"
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
    subtitle?: string
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
            {(subtitle || tooltipContent) && (
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
            )}
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
