import { MouseEvent, useCallback, useEffect, useMemo, useRef } from "react"
import { useAtom, useAtomValue } from "jotai"
import * as d3 from "d3"
import { formatCurrency } from "../utils/incomePlotUtils.ts"
import {
    atomCombinedFactor,
    atomCountryRegionMap,
    atomCurrentCurrency,
    atomCustomPovertyLine,
    atomHoveredEntity,
    atomHoveredEntityType,
    atomHoveredX,
    atomKdeDataForYear,
    atomKdeXValues,
    atomPlotColorScale,
    atomShowCustomPovertyLine,
} from "../store.ts"
import {
    PLOT_HEIGHT,
    PLOT_WIDTH,
    StackedSeriesPoint,
} from "../utils/incomePlotConstants.ts"
import * as R from "remeda"

const style = {
    fontFamily:
        'Lato, "Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif',
    fontSize: "11.5px",
    maxWidth: "100%",
    display: "block",
}

interface IncomePlotProps {
    width?: number
    height?: number
}

export function IncomePlot({
    width = PLOT_WIDTH,
    height = PLOT_HEIGHT,
}: IncomePlotProps) {
    const svgRef = useRef<SVGSVGElement>(null)
    const xAxisRef = useRef<SVGGElement>(null)
    const points = useAtomValue(atomKdeDataForYear)
    const [povertyLine, setPovertyLine] = useAtom(atomCustomPovertyLine)
    const [showPovertyLine, setShowPovertyLine] = useAtom(
        atomShowCustomPovertyLine
    )
    const countryRegionMap = useAtomValue(atomCountryRegionMap)
    const xValues = useAtomValue(atomKdeXValues)
    const plotColorScaleConfig = useAtomValue(atomPlotColorScale)
    const [hoveredEntity, setHoveredEntity] = useAtom(atomHoveredEntity)
    const hoveredEntityType = useAtomValue(atomHoveredEntityType)
    const [hoveredX, setHoveredX] = useAtom(atomHoveredX)
    const combinedFactor = useAtomValue(atomCombinedFactor)
    const currentCurrency = useAtomValue(atomCurrentCurrency)

    // Margins
    const marginTop = 10
    const marginRight = 20
    const marginBottom = 30
    const marginLeft = 20

    const colorScale = useMemo(() => {
        return d3
            .scaleOrdinal()
            .domain(plotColorScaleConfig.domain)
            .range(plotColorScaleConfig.range)
    }, [plotColorScaleConfig])

    // Prepare Data for Stack
    const stackedSeries = useMemo(() => {
        // 1. Group by X and pivot
        // Create a map for quick lookup: x -> { country: y }
        const dataMap = new Map<number, { [key: string]: number }>()
        points.forEach((d) => {
            if (!dataMap.has(d.x)) dataMap.set(d.x, {})
            const xMap = dataMap.get(d.x)!
            xMap[d.country] = d.y
        })

        const countries = Array.from(countryRegionMap.keys())

        const stackedDataInput = xValues.map((x) => {
            const row: any = { x }
            const xValuesMap = dataMap.get(x) || {}
            countries.forEach((country) => {
                row[country] = xValuesMap[country] || 0
            })
            return row
        })

        // 2. Stack
        const stack = d3.stack().keys(countries)

        const stackedSeries = stack(stackedDataInput)

        stackedSeries.forEach((s) => {
            const series = s as unknown as StackedSeriesPoint
            series["country"] = series.key
            series["region"] = countryRegionMap.get(series.key)!
            series["color"] = colorScale(series["region"]!) as string
        })

        return stackedSeries as unknown as StackedSeriesPoint[]
    }, [points, countryRegionMap, xValues, colorScale])

    const { xScale, yScale } = useMemo(() => {
        // 3. Scales
        const xMin = R.first(xValues)
        const xMax = R.last(xValues)
        const xDomain = [xMin, xMax]

        const xScale = d3
            .scaleLog()
            .domain(xDomain)
            .range([marginLeft, width - marginRight])

        const yMax = d3.max(R.last(stackedSeries)!.map((d) => d[1])) || 1

        const yScale = d3
            .scaleLinear()
            .domain([0, yMax])
            .range([height - marginBottom, marginTop])
        return { xScale, yScale }
    }, [xValues, width, stackedSeries, height])

    const hoverRightThresholdPlaced = useMemo(() => {
        const activePovertyLine = showPovertyLine ? povertyLine : null
        const threshold = activePovertyLine ?? hoveredX
        if (!xScale || threshold === null) return null
        return xScale(threshold)
    }, [showPovertyLine, povertyLine, hoveredX, xScale])

    // Area Generator
    const area = useMemo(() => {
        if (!xScale || !yScale) return null
        return d3
            .area<any>()
            .x((d) => xScale(d.data.x))
            .y0((d) => yScale(d[0]))
            .y1((d) => yScale(d[1]))
    }, [xScale, yScale])

    // Render X Axis
    useEffect(() => {
        if (!xAxisRef.current || !xScale) return

        const g = d3.select(xAxisRef.current)

        const [min, max] = xScale.domain()
        const xTicks: number[] = []
        for (
            let power = Math.floor(Math.log10(min * combinedFactor));
            Math.pow(10, power) <= max * combinedFactor;
            power++
        ) {
            const base = Math.pow(10, power)
            ;[1, 2, 3, 5].forEach((multiplier) => {
                const val = (base * multiplier) / combinedFactor
                if (val >= min && val <= max) xTicks.push(val)
            })
        }

        const xAxis = d3
            .axisBottom(xScale)
            .tickValues(xTicks)
            .tickFormat((d) =>
                formatCurrency((d as number) * combinedFactor, currentCurrency)
            )
            .tickSizeOuter(0)

        g.call(xAxis)

        g.select(".domain").remove()
        g.selectAll(".tick line")
            .clone()
            .attr("y2", -(height - marginBottom - marginTop))
            .attr("stroke-opacity", 0.1)

        return () => void g.selectAll("*").remove()
    }, [
        xScale,
        height,
        marginBottom,
        marginTop,
        currentCurrency,
        combinedFactor,
    ])

    const onMouseMove = useCallback(
        (event: MouseEvent) => {
            if (!xScale || !yScale || !stackedSeries.length || !svgRef.current)
                return

            const [mx, my] = d3.pointer(event, svgRef.current)
            const xVal = xScale.invert(mx)
            const yVal = yScale.invert(my)

            // Find closest data point index
            const data = stackedSeries[0].map((d) => d.data as any)
            const bisect = d3.bisector((d: any) => d.x).center
            const index = bisect(data, xVal)

            if (index >= 0 && index < data.length) {
                const d = data[index]
                setHoveredX(d.x)

                let foundRegion = null
                for (const layer of stackedSeries) {
                    const [y0, y1] = layer[index]
                    if (yVal >= y0 && yVal <= y1) {
                        foundRegion = layer.key
                        break
                    }
                }
                setHoveredEntity(foundRegion)
            }
        },
        [xScale, yScale, stackedSeries, setHoveredX, setHoveredEntity]
    )

    const onMouseLeave = useCallback(() => {
        setHoveredEntity(null)
        setHoveredX(null)
    }, [setHoveredEntity, setHoveredX])

    const onClick = useCallback(
        (event: MouseEvent) => {
            if (!xScale || !svgRef.current) return
            const [mx] = d3.pointer(event, svgRef.current)
            const xVal = xScale.invert(mx)

            setPovertyLine(xVal)
            setShowPovertyLine((showPovertyLine) => !showPovertyLine)
        },
        [xScale, setPovertyLine, setShowPovertyLine]
    )

    return (
        <div className="income-plot-chart">
            <svg
                ref={svgRef}
                className="income-plot-chart-svg"
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                style={style}
                onMouseMove={onMouseMove}
                onMouseLeave={onMouseLeave}
                onClick={onClick}
            >
                <defs>
                    <clipPath id="highlight-clip">
                        <rect
                            x="0"
                            y="0"
                            width={hoverRightThresholdPlaced ?? width}
                            height={height}
                        />
                    </clipPath>
                </defs>
                <g className="plot-series">
                    {stackedSeries.map((series) => {
                        const d = area ? area(series) : undefined
                        if (!d) return null
                        const isHighlighted =
                            hoveredEntityType === null
                                ? undefined
                                : series[hoveredEntityType] === hoveredEntity

                        return (
                            <g
                                key={series.key}
                                className="income-plot-series"
                                data-country={series.key}
                                data-region={series["region"]}
                                data-highlighted={isHighlighted}
                            >
                                <path
                                    className="area-bg"
                                    fill={series["color"]}
                                    d={d}
                                />
                                <path
                                    className="area-fg"
                                    fill={series["color"]}
                                    d={d}
                                    clipPath="url(#highlight-clip)"
                                    style={{ pointerEvents: "none" }}
                                />
                            </g>
                        )
                    })}
                </g>
                <g
                    className="x-axis"
                    ref={xAxisRef}
                    transform={`translate(0,${height - marginBottom})`}
                />
                {/* Render poverty line, if enabled */}
                {showPovertyLine && xScale && (
                    <g className="poverty-line">
                        <line
                            x1={xScale(povertyLine)}
                            x2={xScale(povertyLine)}
                            y1={marginTop}
                            y2={height - marginBottom}
                            stroke="#d73027"
                            strokeWidth={2}
                            strokeDasharray="5,5"
                        />
                        <text
                            x={xScale(povertyLine) + 5}
                            y={marginTop + 10}
                            fill="#d73027"
                            fontWeight="bold"
                        >
                            {`Poverty line: ${formatCurrency(
                                povertyLine * combinedFactor,
                                currentCurrency
                            )}`}
                        </text>
                    </g>
                )}
                {/* Render hovered X line and label */}
                {hoveredX !== null && xScale && (
                    <g className="pointer">
                        <line
                            x1={xScale(hoveredX)}
                            x2={xScale(hoveredX)}
                            y1={marginTop}
                            y2={height - marginBottom}
                            stroke="red"
                            strokeOpacity={0.15}
                            style={{ pointerEvents: "none" }}
                        />
                        <text
                            x={xScale(hoveredX)}
                            y={height - marginBottom + 9}
                            dy="0.71em"
                            fill="red"
                            stroke="white"
                            strokeWidth={3}
                            paintOrder="stroke"
                        >
                            {formatCurrency(
                                hoveredX * combinedFactor,
                                currentCurrency
                            )}
                        </text>
                    </g>
                )}
                <rect
                    className="overlay"
                    x={marginLeft}
                    y={marginTop}
                    width={width - marginLeft - marginRight}
                    height={height - marginTop - marginBottom}
                    fill="transparent"
                    style={{ pointerEvents: "none" }}
                />
            </svg>
        </div>
    )
}
