import cx from "classnames"
import { useCallback, useMemo, useRef, useState } from "react"
import { Tippy } from "@ourworldindata/utils"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons"
import { Tabs, TabList, Tab, TabPanel } from "react-aria-components"
import { LinePath } from "@visx/shape"
import { scaleLinear } from "@visx/scale"
import { GrapherTrendArrow, Halo } from "@ourworldindata/components"
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
    HISTORICAL_END_YEAR,
    CONTROL_YEARS,
    FULL_TIME_RANGE,
    BENCHMARK_LINE_COLOR,
    USER_MODIFIED_COLOR,
    DENIM_BLUE,
    PROJECTION_BACKGROUND,
} from "../helpers/constants.js"
import { getInterpolatedValue } from "../model/projectionRunner.js"
import { PopulationChartLegend } from "./PopulationChartLegend.js"
import { parameterConfigByKey } from "../helpers/parameterConfigs.js"
import { useTippyContainer } from "../../../../hooks/useTippyContainer.js"
import {
    GRAY_60,
    GRAPHER_LIGHT_TEXT,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"

const PARAMETER_TAB_LABELS: Record<ParameterKey, string> = {
    fertilityRate: "Fertility Rate",
    lifeExpectancy: "Life expectancy",
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

    const title = makeTitle({ focusParameter })
    const hasUserChanges = simulation.activePreset !== "unwpp"
    const pyramidBarColor =
        hasUserChanges && year > HISTORICAL_END_YEAR
            ? USER_MODIFIED_COLOR
            : undefined

    return (
        <div className="chart-content">
            <div className="container container-left">
                <div className="input-panels">
                    <Tabs
                        className="input-tabs"
                        defaultSelectedKey={
                            focusParameter ?? "fertilityRate"
                        }
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
                                (focusParameter &&
                                    focusParameter !== key) ||
                                isWorldMigration
                            const isNonInteractive =
                                (focusParameter &&
                                    focusParameter !== key) ||
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
                                        interactive={
                                            !isNonInteractive
                                        }
                                        lineColor={
                                            isMuted
                                                ? BENCHMARK_LINE_COLOR
                                                : undefined
                                        }
                                        labelColor={
                                            isMuted
                                                ? GRAY_60
                                                : undefined
                                        }
                                        resetTarget={
                                            stabilizedOverrides?.[
                                                key
                                            ]
                                        }
                                        hideInfoIcon={
                                            isWorldMigration
                                        }
                                        showProjectionLabel
                                        className={cx({
                                            "chart-panel--focus":
                                                focusParameter &&
                                                focusParameter ===
                                                    key,
                                            "chart-panel--muted":
                                                isMuted,
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
                <div className="output-panels">
                    <ChartPanel
                        className="population-panel"
                        title="Population"
                        subtitle="Historical estimates and projections of total population"
                        header={<PopulationChartLegend modified={hasUserChanges} />}
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

function AssumptionsTable({
    simulation,
}: {
    simulation: Simulation
}) {
    return (
        <table className="assumptions-table">
            <thead>
                <tr>
                    <th></th>
                    {PARAMETER_KEYS.map((key) => {
                        return (
                            <th key={key}>
                                {PARAMETER_TAB_LABELS[key]}
                                <Tippy
                                    content={
                                        parameterConfigByKey[key]
                                            .tooltipContent
                                    }
                                    placement="top"
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
                        <td className="assumptions-table__year">
                            In {yr}
                        </td>
                        {PARAMETER_KEYS.map((key) => {
                            const config = parameterConfigByKey[key]
                            const unit =
                                key === "lifeExpectancy"
                                    ? " years"
                                    : key === "fertilityRate"
                                      ? " births"
                                      : ""
                            const userVal =
                                simulation.scenarioParams[key][yr]
                            const refVal =
                                simulation.unwppScenarioParams[key][
                                    yr
                                ]
                            const isModified =
                                Math.abs(userVal - refVal) >= 0.01
                            const direction =
                                userVal > refVal
                                    ? "up"
                                    : ("down" as const)
                            return (
                                <td
                                    key={key}
                                    className={
                                        isModified
                                            ? "assumptions-table__value--modified"
                                            : "assumptions-table__value--default"
                                    }
                                >
                                    {isModified && (
                                        <span className="assumptions-table__arrow-circle">
                                            <GrapherTrendArrow
                                                direction={direction}
                                                isColored={false}
                                                className="assumptions-table__arrow"
                                            />
                                        </span>
                                    )}
                                    {config.formatValue(
                                        isModified
                                            ? userVal
                                            : refVal
                                    )}
                                    {unit}
                                </td>
                            )
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

function CollapsedSummary({
    simulation,
    variant,
}: {
    simulation: Simulation
    variant: ParameterKey
}) {
    const config = parameterConfigByKey[variant]
    const formatVal = config.formatValue
    const unit =
        variant === "lifeExpectancy"
            ? " years"
            : variant === "fertilityRate"
              ? " births"
              : ""
    const controlPoints = simulation.scenarioParams[variant]
    const referencePoints = simulation.unwppScenarioParams[variant]

    // Get the last historical value
    const { points: historical } = config.computeHistorical(simulation)
    const lastHistorical = historical.at(-1)

    // Check which control years the user has modified
    const modifiedYears = CONTROL_YEARS.filter(
        (yr) => Math.abs(controlPoints[yr] - referencePoints[yr]) >= 0.01
    )

    const current = lastHistorical
        ? `${formatVal(lastHistorical.value)}${unit} in ${lastHistorical.year}`
        : ""

    const isModified = modifiedYears.length > 0

    let projectionText: string
    if (isModified) {
        const modified = modifiedYears.map(
            (yr) => `${formatVal(controlPoints[yr])}${unit} by ${yr}`
        )
        projectionText = `set to ${modified.join(", ")}`
    } else {
        const endValue = controlPoints[CONTROL_YEARS[CONTROL_YEARS.length - 1]]
        projectionText = `projected ${formatVal(endValue)}${unit} by ${CONTROL_YEARS[CONTROL_YEARS.length - 1]}`
    }

    return (
        <span className="input-accordion__trigger-summary">
            {current} →{" "}
            <span
                className={
                    isModified
                        ? "input-accordion__trigger-summary--modified"
                        : undefined
                }
            >
                {projectionText}
            </span>
        </span>
    )
}

function CollapsedSparkline({
    simulation,
    variant,
}: {
    simulation: Simulation
    variant: ParameterKey
}) {
    const config = parameterConfigByKey[variant]
    const isModified = simulation.modifiedParameters.has(variant)

    const {
        historicalPoints,
        projectionPoints,
        benchmarkPoints,
        minValue,
        maxValue,
    } = useMemo(() => {
        const {
            points: historical,
            min,
            max,
        } = config.computeHistorical(simulation)

        const lastHistorical = historical.at(-1)
        if (!lastHistorical)
            return {
                historicalPoints: historical,
                projectionPoints: [],
                benchmarkPoints: [],
                minValue: min,
                maxValue: max,
            }

        const augmentedYears = [HISTORICAL_END_YEAR, ...CONTROL_YEARS]

        const buildProjection = (
            params: Record<number, number>
        ): { year: number; value: number }[] => {
            const aug: Record<number, number> = {
                [HISTORICAL_END_YEAR]: lastHistorical.value,
                ...params,
            }
            const pts: { year: number; value: number }[] = []
            for (
                let year = HISTORICAL_END_YEAR + 1;
                year <= END_YEAR;
                year++
            ) {
                pts.push({
                    year,
                    value: getInterpolatedValue(
                        aug,
                        year,
                        HISTORICAL_END_YEAR,
                        augmentedYears
                    ),
                })
            }
            return pts
        }

        const projection = buildProjection(
            simulation.scenarioParams[variant]
        )
        const benchmark = buildProjection(
            simulation.unwppScenarioParams[variant]
        )

        const controlValues = Object.values(
            simulation.scenarioParams[variant]
        )
        const historicalValues = historical.map((d) => d.value)
        const allProjectionValues = [
            ...projection.map((d) => d.value),
            ...benchmark.map((d) => d.value),
        ]
        return {
            historicalPoints: historical,
            projectionPoints: [lastHistorical, ...projection],
            benchmarkPoints: [lastHistorical, ...benchmark],
            minValue: Math.max(
                config.yFloor ?? -Infinity,
                Math.min(
                    Math.min(...controlValues) - config.yPadding,
                    Math.min(...historicalValues),
                    Math.min(...allProjectionValues)
                )
            ),
            maxValue: Math.max(
                Math.max(...controlValues) + config.yPadding,
                Math.max(...historicalValues),
                Math.max(...allProjectionValues)
            ),
        }
    }, [simulation, variant, config])
    const points = [...historicalPoints, ...projectionPoints.slice(1)]

    const containerRef = useRef<HTMLDivElement>(null)
    const [size, setSize] = useState({ width: 0, height: 0 })

    const resizeRef = useCallback((node: HTMLDivElement | null) => {
        containerRef.current = node
        if (!node) return
        const obs = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect
            setSize({ width, height })
        })
        obs.observe(node)
        return () => obs.disconnect()
    }, [])

    if (points.length === 0) return null

    const { width, height } = size
    const dotRadius = 3
    const fontSize = 10
    const xScale = scaleLinear({
        domain: [START_YEAR, END_YEAR],
        range: [dotRadius, width - dotRadius],
    })
    const yScale = scaleLinear({
        domain: [minValue, maxValue],
        range: [height - 2, 2],
        clamp: true,
    })

    const firstPoint = points[0]
    const lastPoint = points[points.length - 1]
    const projectionColor = isModified ? USER_MODIFIED_COLOR : DENIM_BLUE
    const formatVal = config.formatValue

    // Build labeled points with their screen positions
    const controlPointYears = [2030, 2050] as const
    const augmentedControlPoints = {
        [HISTORICAL_END_YEAR]:
            points.find((p) => p.year === HISTORICAL_END_YEAR)?.value ?? 0,
        ...simulation.scenarioParams[variant],
    }
    const augmentedYears = [HISTORICAL_END_YEAR, ...CONTROL_YEARS]

    const labeledPoints = [
        ...(firstPoint
            ? [
                  {
                      year: firstPoint.year,
                      x: xScale(firstPoint.year),
                      y: yScale(firstPoint.value),
                      label: formatVal(firstPoint.value),
                      textAnchor: "start" as const,
                  },
              ]
            : []),
        ...controlPointYears.map((yr) => {
            const val = getInterpolatedValue(
                augmentedControlPoints,
                yr,
                HISTORICAL_END_YEAR,
                augmentedYears
            )
            return {
                year: yr,
                x: xScale(yr),
                y: yScale(val),
                label: formatVal(val),
                textAnchor: "middle" as const,
            }
        }),
        ...(lastPoint
            ? [
                  {
                      year: lastPoint.year,
                      x: xScale(lastPoint.year),
                      y: yScale(lastPoint.value),
                      label: formatVal(lastPoint.value),
                      textAnchor: "end" as const,
                  },
              ]
            : []),
    ]

    return (
        <div ref={resizeRef} className="input-accordion__sparkline">
            {width > 0 && height > 0 && (
                <svg
                    width={width}
                    height={height}
                    style={{ overflow: "visible" }}
                >
                    <LinePath
                        data={benchmarkPoints}
                        x={(d) => xScale(d.year)}
                        y={(d) => yScale(d.value)}
                        stroke={BENCHMARK_LINE_COLOR}
                        strokeWidth={1.5}
                        strokeDasharray="1,2"
                        strokeLinecap="butt"
                    />
                    <LinePath
                        data={historicalPoints}
                        x={(d) => xScale(d.year)}
                        y={(d) => yScale(d.value)}
                        stroke={DENIM_BLUE}
                        strokeWidth={1.5}
                    />
                    <LinePath
                        data={projectionPoints}
                        x={(d) => xScale(d.year)}
                        y={(d) => yScale(d.value)}
                        stroke={projectionColor}
                        strokeWidth={1.5}
                        strokeDasharray="1,2"
                        strokeLinecap="butt"
                    />
                    {labeledPoints.map((pt) => (
                        <SparklinePointLabel
                            key={pt.year}
                            x={pt.x}
                            y={pt.y}
                            label={pt.label}
                            color={pt.year <= HISTORICAL_END_YEAR ? DENIM_BLUE : projectionColor}
                            fontSize={fontSize}
                            dotRadius={dotRadius}
                            textAnchor={pt.textAnchor}
                        />
                    ))}
                </svg>
            )}
        </div>
    )
}

function SparklinePointLabel({
    x,
    y,
    label,
    color,
    fontSize,
    dotRadius,
    textAnchor = "middle",
}: {
    x: number
    y: number
    label: string
    color: string
    fontSize: number
    dotRadius: number
    textAnchor?: "start" | "middle" | "end"
}) {
    // Above by default; below if the dot is too close to the top of the SVG
    const labelY =
        y < 20 ? y + fontSize / 2 + 8 : y - fontSize / 2 - 3

    return (
        <>
            <circle cx={x} cy={y} r={dotRadius} fill={color} />
            <Halo id="sparkline-label" outlineWidth={3} outlineColor="#f0f4fa">
                <text
                    x={x}
                    y={labelY}
                    fontSize={fontSize}
                    fontWeight={700}
                    fill={color}
                    textAnchor={textAnchor}
                >
                    {label}
                </text>
            </Halo>
        </>
    )
}

function ArrowFromInputToOutputPanels() {
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
