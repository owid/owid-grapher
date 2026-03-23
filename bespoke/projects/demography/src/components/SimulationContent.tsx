import cx from "classnames"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Tippy } from "@ourworldindata/utils"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons"
import { BezierArrow } from "../../../../components/BezierArrow/BezierArrow"
import { CountryData, PARAMETER_KEYS, ParameterKey } from "../helpers/types"
import { useSimulation, type Simulation } from "../helpers/useSimulation"
import { ResponsivePopulationChart } from "./PopulationChart.js"
import { ResponsiveDemographyParameterEditor } from "./DemographyParameterEditor.js"
import { ResponsivePopulationPyramid } from "./PopulationPyramid.js"
import { ResponsivePopulationPyramidHorizontal } from "./PopulationPyramidHorizontal.js"
import { TimeSlider } from "../../../../components/TimeSlider/TimeSlider.js"
import {
    START_YEAR,
    END_YEAR,
    FULL_TIME_RANGE,
    HISTORICAL_END_YEAR,
    BENCHMARK_LINE_COLOR,
} from "../helpers/constants.js"
import { PopulationChartLegend } from "./PopulationChartLegend.js"
import { parameterConfigByKey } from "../helpers/parameterConfigs.js"
import { getPopulationForYear } from "../helpers/utils.js"
import { stabilizeParameter } from "../model/stabilize.js"
import { GRAPHER_LIGHT_TEXT } from "@ourworldindata/grapher/src/color/ColorConstants.js"

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

    const simulation = useSimulation(data)

    // Keep a ref to setScenarioParams so the effect doesn't re-run
    // when the simulation object changes identity
    const setScenarioParamsRef = useRef(simulation?.setScenarioParams)
    setScenarioParamsRef.current = simulation?.setScenarioParams

    // Extract stable references for the stabilization computation.
    // These only change when the country changes (new data loaded).
    const unwppScenarioParams = simulation?.unwppScenarioParams
    const baselineParams = simulation?.baselineParams

    // Compute stabilized params from the UN WPP baseline (not current scenario)
    // so that user drags don't trigger re-stabilization
    const stabilizedParams = useMemo(() => {
        if (!stabilizingParameter || !unwppScenarioParams || !baselineParams)
            return null

        const startPopulation = getPopulationForYear(data, HISTORICAL_END_YEAR)
        if (!startPopulation) return null

        const result = stabilizeParameter(
            stabilizingParameter,
            unwppScenarioParams,
            baselineParams,
            startPopulation
        )
        return result.params
    }, [stabilizingParameter, unwppScenarioParams, baselineParams, data])

    // Apply stabilized params once on mount and when country changes
    useEffect(() => {
        if (stabilizedParams) {
            setScenarioParamsRef.current?.(stabilizedParams)
        }
    }, [stabilizedParams])

    if (!simulation) return null

    return (
        <div className="chart-content">
            <Container
                className="container-left"
                title={
                    focusParameter
                        ? `Change ${parameterConfigByKey[focusParameter].title.toLowerCase()} assumptions`
                        : "Change these assumptions"
                }
            >
                <div className="input-panels">
                    {PARAMETER_KEYS.map((key) => {
                        const isFocus = focusParameter && focusParameter === key
                        const isMuted = focusParameter && focusParameter !== key
                        return (
                            <InputChartPanel
                                key={key}
                                simulation={simulation}
                                variant={key}
                                interactive={
                                    !focusParameter || focusParameter === key
                                }
                                lineColor={
                                    isMuted ? BENCHMARK_LINE_COLOR : undefined
                                }
                                labelColor={
                                    isMuted ? GRAPHER_LIGHT_TEXT : undefined
                                }
                                hideReset={!!stabilizingParameter}
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
                        subtitle="Past estimates and future projections"
                        header={<PopulationChartLegend />}
                    >
                        <ResponsivePopulationChart
                            simulation={simulation}
                            hideChangeAnnotation={!!stabilizingParameter}
                        />
                    </ChartPanel>
                    {!hidePopulationPyramid && (
                        <>
                            <ChartPanel
                                className="pyramid-panel"
                                title={`Age Structure in ${year}`}
                                subtitle="Population distribution by age and sex"
                                footer={
                                    <SimpleYearSlider
                                        selectedYear={year}
                                        onChange={setYear}
                                    />
                                }
                            >
                                <ResponsivePopulationPyramid
                                    simulation={simulation}
                                    year={year}
                                    compact
                                />
                            </ChartPanel>
                            <ChartPanel
                                className="age-distribution-panel"
                                title={`Age Structure in ${year}`}
                                subtitle="Population distribution by age"
                                header={
                                    <SimpleYearSlider
                                        selectedYear={year}
                                        onChange={setYear}
                                    />
                                }
                            >
                                <ResponsivePopulationPyramidHorizontal
                                    simulation={simulation}
                                    year={year}
                                />
                            </ChartPanel>
                        </>
                    )}
                </div>
            </Container>
        </div>
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
    hideReset = false,
    showProjectionLabel,
}: {
    simulation: Simulation
    variant: ParameterKey
    className?: string
    interactive?: boolean
    lineColor?: string
    labelColor?: string
    hideReset?: boolean
    showProjectionLabel?: boolean
}) {
    const { title, subtitle, tooltipContent } = parameterConfigByKey[variant]

    const hasResetButton =
        !hideReset &&
        interactive &&
        Object.keys(simulation.unwppScenarioParams[variant]).some(
            (k) =>
                simulation.scenarioParams[variant][Number(k)] !==
                simulation.unwppScenarioParams[variant][Number(k)]
        )

    const handleReset = useCallback(() => {
        simulation.setScenarioParams({
            ...simulation.scenarioParams,
            [variant]: { ...simulation.unwppScenarioParams[variant] },
        })
    }, [simulation, variant])

    return (
        <ChartPanel
            className={className}
            title={title}
            subtitle={subtitle}
            tooltipContent={tooltipContent}
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
    const panelRef = useRef<HTMLDivElement>(null)
    const getTippyContainer = useCallback(() => {
        const root = panelRef.current?.getRootNode()
        if (root instanceof ShadowRoot) return root as unknown as Element
        return document.body
    }, [])

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
    return (
        <svg className="container-arrow" viewBox="0 0 60 20">
            <BezierArrow
                start={[10, 10]}
                end={[60 - 10, 10]}
                color="currentColor"
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
