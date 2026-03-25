import cx from "classnames"
import { useCallback, useMemo, useState } from "react"
import { Tippy } from "@ourworldindata/utils"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons"
import { BezierArrow } from "../../../../components/BezierArrow/BezierArrow"
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
    FULL_TIME_RANGE,
    BENCHMARK_LINE_COLOR,
} from "../helpers/constants.js"
import { PopulationChartLegend } from "./PopulationChartLegend.js"
import { parameterConfigByKey } from "../helpers/parameterConfigs.js"
import { useBreakpoint } from "../helpers/useBreakpoint.js"
import { useTippyContainer } from "../../../../hooks/useTippyContainer.js"
import {
    GRAY_60,
    GRAPHER_LIGHT_TEXT,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"

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

    const title = makeTitle({ focusParameter })

    return (
        <div className="chart-content">
            <Container className="container-left" title={title}>
                <div className="input-panels">
                    {PARAMETER_KEYS.map((key) => {
                        const isFocus = focusParameter && focusParameter === key
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
                            <InputChartPanel
                                key={key}
                                simulation={simulation}
                                variant={key}
                                interactive={!isNonInteractive}
                                lineColor={
                                    isMuted ? BENCHMARK_LINE_COLOR : undefined
                                }
                                labelColor={isMuted ? GRAY_60 : undefined}
                                resetTarget={stabilizedOverrides?.[key]}
                                hideInfoIcon={isWorldMigration}
                                className={cx({
                                    "chart-panel--focus": isFocus,
                                    "chart-panel--muted": isMuted,
                                })}
                            />
                        )
                    })}
                </div>
            </Container>
            <ArrowFromInputToOutputPanels />
            <Container
                className="container-right"
                title={
                    focusParameter
                        ? "See how this affects population projections"
                        : "See how they affect population projections"
                }
            >
                <div className="output-panels">
                    <ChartPanel
                        className="population-panel"
                        title="Population"
                        subtitle="Historical estimates and projections of total population"
                        header={<PopulationChartLegend />}
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
                        />
                    )}
                </div>
            </Container>
        </div>
    )
}

function AgeStructurePanel({
    simulation,
    year,
    onYearChange,
}: {
    simulation: Simulation
    year: number
    onYearChange: (year: number) => void
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
                />
            </ChartPanel>
        </>
    )
}

function Container({
    title,
    children,
    className,
}: {
    title: string
    children: React.ReactNode
    className?: string
}) {
    return (
        <div className={cx("container", className)}>
            <h3 className="container__title">{title}</h3>
            {children}
        </div>
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
        >
            <ResponsiveDemographyParameterEditor
                simulation={simulation}
                variant={variant}
                interactive={interactive}
                lineColor={lineColor}
                labelColor={labelColor}
                showProjectionLabel={showProjectionLabel}
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
            {header && <div className="chart-panel__header">{header}</div>}
            {children && <div className="chart-panel__content">{children}</div>}
            {footer && <div className="chart-panel__footer">{footer}</div>}
        </div>
    )
}

function ArrowFromInputToOutputPanels() {
    const breakpoint = useBreakpoint()
    const isVertical = breakpoint === "small" || breakpoint === "narrow"

    if (isVertical) {
        return (
            <svg className="container-arrow" viewBox="0 0 36 36">
                <BezierArrow
                    start={[18, 6]}
                    end={[18, 30]}
                    color={GRAPHER_LIGHT_TEXT}
                    width={2}
                    headAnchor="end"
                    headLength={6}
                />
            </svg>
        )
    }

    return (
        <svg className="container-arrow" viewBox="0 0 60 20">
            <BezierArrow
                start={[10, 10]}
                end={[60 - 10, 10]}
                color={GRAPHER_LIGHT_TEXT}
                width={2}
                headAnchor="end"
                headLength={6}
            />
        </svg>
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

function makeTitle({ focusParameter }: { focusParameter?: ParameterKey }) {
    if (!focusParameter) return "Change these future assumptions"

    switch (focusParameter) {
        case "fertilityRate":
            return "Change future assumptions about fertility"
        case "lifeExpectancy":
            return "Change future assumptions about life expectancy"
        case "netMigrationRate":
            return "Change future assumptions about migration"
    }
}
