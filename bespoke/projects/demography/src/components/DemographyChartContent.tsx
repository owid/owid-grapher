import cx from "classnames"
import { useCallback, useState } from "react"
import { Bounds, Tippy } from "@ourworldindata/utils"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons"
import { useChartDimensions } from "../../../../hooks/useDimensions"
import { BezierArrow } from "../../../../components/BezierArrow/BezierArrow"
import { CountryData, DemographyMetadata } from "../helpers/DemographyTypes"
import { useSimulation, type Simulation } from "../helpers/useSimulation"
import { ResponsivePopulationChart } from "./PopulationChart.js"
import {
    DemographyInputChart,
    VARIANT_CONFIG,
    type InputChartVariant,
} from "./DemographyInputChart.js"
import { DemographyPyramidChart } from "./DemographyPyramidChart.js"
import { TimeSlider } from "../../../../components/TimeSlider/TimeSlider.js"
import { START_YEAR, END_YEAR } from "../helpers/constants.js"
import { DemographyPopulationChartLegend } from "./DemographyPopulationChartLegend.js"

const YEAR_TIMES = Array.from(
    { length: END_YEAR - START_YEAR + 1 },
    (_, i) => START_YEAR + i
)

export function ResponsiveDemographyChartContent({
    data,
    metadata,
}: {
    data: CountryData
    metadata: DemographyMetadata
}) {
    return <DemographyChartContent data={data} metadata={metadata} />
}

function DemographyChartContent({
    data,
    metadata,
}: {
    data: CountryData
    metadata: DemographyMetadata
}) {
    const [year, setYear] = useState(2100)

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
                        variant="net-migration"
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
                        subtitle="Past estimates and future projections based on fertility rate, life expectancy, and net migration assumptions"
                        header={<DemographyPopulationChartLegend />}
                    >
                        <ResponsivePopulationChart simulation={simulation} />
                    </ChartPanel>
                    <ChartPanel
                        title={`Age Structure in ${year}`}
                        subtitle={`Population distribution by age and sex. The median age in ${year} is ${simulation.getStatsForYear(year)?.medianAge ?? "–"}.`}
                        footer={
                            <YearSlider
                                selectedYear={year}
                                onChange={setYear}
                            />
                        }
                    >
                        <DemographyPyramidChart
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

function InputChartPanel({
    simulation,
    variant,
}: {
    simulation: Simulation
    variant: InputChartVariant
}) {
    const { title, subtitle, tooltipContent, paramKey } =
        VARIANT_CONFIG[variant]

    const isModified = Object.keys(
        simulation.unwppScenarioParams[paramKey]
    ).some(
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
            title={title}
            subtitle={subtitle}
            tooltipContent={tooltipContent}
            onReset={isModified ? handleReset : undefined}
        >
            <DemographyInputChart simulation={simulation} variant={variant} />
        </ChartPanel>
    )
}

function ChartPanel({
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
                    <Tippy content={tooltipContent} placement="top">
                        <span className="chart-panel__info-icon">
                            <FontAwesomeIcon icon={faCircleInfo} size="sm" />
                        </span>
                    </Tippy>
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

function YearSlider({
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
                times={YEAR_TIMES}
                selectedTime={selectedYear}
                onChange={onChange}
                showEdgeLabels={false}
            />
            <span className="demography-year-slider__label">{END_YEAR}</span>
        </div>
    )
}
