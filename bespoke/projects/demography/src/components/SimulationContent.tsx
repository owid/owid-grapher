import cx from "classnames"
import { useCallback, useState } from "react"
import { Tippy } from "@ourworldindata/utils"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons"
import { BezierArrow } from "../../../../components/BezierArrow/BezierArrow"
import { CountryData, ParameterKey } from "../helpers/types"
import { useSimulation, type Simulation } from "../helpers/useSimulation"
import { ResponsivePopulationChart } from "./PopulationChart.js"
import { ResponsiveDemographyParameterEditor } from "./DemographyParameterEditor.js"
import { ResponsivePopulationPyramid } from "./PopulationPyramid.js"
import { TimeSlider } from "../../../../components/TimeSlider/TimeSlider.js"
import { START_YEAR, END_YEAR, FULL_TIME_RANGE } from "../helpers/constants.js"
import { PopulationChartLegend } from "./PopulationChartLegend.js"
import { parameterConfigByKey } from "../helpers/parameterConfigs.js"

export function SimulationContent({ data }: { data: CountryData }) {
    const [year, setYear] = useState(END_YEAR)

    const simulation = useSimulation(data)

    if (!simulation) return null

    return (
        <div className="chart-content">
            <Container
                className="container-left"
                title="Change these assumptions"
            >
                <div className="input-panels">
                    <InputChartPanel
                        simulation={simulation}
                        variant="fertility-rate"
                    />
                    <InputChartPanel
                        simulation={simulation}
                        variant="life-expectancy"
                    />
                    <InputChartPanel
                        simulation={simulation}
                        variant="net-migration-rate"
                    />
                </div>
            </Container>
            <ArrowFromInputToOutputPanels />
            <Container
                className="container-right"
                title="See how they affect population projections"
            >
                <div className="output-panels">
                    <ChartPanel
                        className="population-panel"
                        title="Population"
                        subtitle="Past estimates and future projections"
                        header={<PopulationChartLegend />}
                    >
                        <ResponsivePopulationChart simulation={simulation} />
                    </ChartPanel>
                    <ChartPanel
                        title={`Age Structure in ${year}`}
                        subtitle={`Population distribution by age and sex`}
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
                        />
                    </ChartPanel>
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
    showProjectionLabel,
    valueLabelFontSize,
}: {
    simulation: Simulation
    variant: ParameterKey
    className?: string
    interactive?: boolean
    showProjectionLabel?: boolean
    valueLabelFontSize?: number
}) {
    const { title, subtitle, tooltipContent, paramKey } =
        parameterConfigByKey[variant]

    const hasResetButton =
        interactive &&
        Object.keys(simulation.unwppScenarioParams[paramKey]).some(
            (k) =>
                simulation.scenarioParams[paramKey][Number(k)] !==
                simulation.unwppScenarioParams[paramKey][Number(k)]
        )

    const handleReset = useCallback(() => {
        simulation.setScenarioParams({
            ...simulation.scenarioParams,
            [paramKey]: { ...simulation.unwppScenarioParams[paramKey] },
        })
    }, [simulation, paramKey])

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
                showProjectionLabel={showProjectionLabel}
                valueLabelFontSize={valueLabelFontSize}
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
    return (
        <div className={cx("chart-panel", className)}>
            {onReset && (
                <button className="chart-panel__reset-btn" onClick={onReset}>
                    Reset
                </button>
            )}
            <h3 className="chart-panel__title">{title}</h3>
            <p className="chart-panel__subtitle">
                {subtitle}
                {tooltipContent && (
                    <>
                        {/* Non-breaking space to prevent the icon from wrapping to a new line alone */}
                        {"\u00a0"}
                        <Tippy content={tooltipContent} placement="top">
                            <span className="chart-panel__info-icon">
                                <FontAwesomeIcon
                                    icon={faCircleInfo}
                                    size="sm"
                                />
                            </span>
                        </Tippy>
                    </>
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
