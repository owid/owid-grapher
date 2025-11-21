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
    atomHoveredX,
    atomKdeDataForYear,
    atomKdeXValues,
    atomPlotColorScale,
    atomShowCustomPovertyLine,
} from "../store.ts"
import { PLOT_HEIGHT, PLOT_WIDTH } from "../utils/incomePlotConstants.ts"
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
    const backgroundAreasRef = useRef<SVGGElement>(null)
    const foregroundAreasRef = useRef<SVGGElement>(null)
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
    const [hoveredX, setHoveredX] = useAtom(atomHoveredX)
    const combinedFactor = useAtomValue(atomCombinedFactor)
    const currentCurrency = useAtomValue(atomCurrentCurrency)

    const hasHoveredEntity = hoveredEntity !== null

    // Margins
    const marginTop = 10
    const marginRight = 20
    const marginBottom = 30
    const marginLeft = 20

    // Prepare Data for Stack
    const { stackedSeries } = useMemo(() => {
        if (!points.length)
            return {
                stackedSeries: [],
                xScale: null,
                yScale: null,
                xDomain: [],
                countryRegionMap: new Map<string, string>(),
            }

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

        return { stackedSeries }
    }, [points, countryRegionMap, xValues])

    const { xScale, yScale } = useMemo(() => {
        // 3. Scales
        const xMin = R.first(xValues) * combinedFactor
        const xMax = R.last(xValues) * combinedFactor
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
    }, [xValues, width, stackedSeries, height, combinedFactor])

    const colorScale = useMemo(() => {
        return d3
            .scaleOrdinal()
            .domain(plotColorScaleConfig.domain)
            .range(plotColorScaleConfig.range)
    }, [plotColorScaleConfig])

    const hoverRightThresholdPlaced = useMemo(() => {
        const activePovertyLine = showPovertyLine ? povertyLine : null
        const threshold = activePovertyLine ?? hoveredX
        if (!xScale || threshold === null) return null
        return xScale(threshold * combinedFactor)
    }, [showPovertyLine, povertyLine, hoveredX, xScale, combinedFactor])

    // Area Generator
    const area = useMemo(() => {
        if (!xScale || !yScale) return null
        return d3
            .area<any>()
            .x((d) => xScale(d.data.x * combinedFactor))
            .y0((d) => yScale(d[0]))
            .y1((d) => yScale(d[1]))
    }, [xScale, yScale, combinedFactor])

    // Render Background Areas
    useEffect(() => {
        if (!backgroundAreasRef.current || !area || !stackedSeries.length)
            return

        const g = d3.select(backgroundAreasRef.current)

        g.selectAll("path")
            .data(stackedSeries)
            .join("path")
            .attr("fill", (d) => {
                const region = countryRegionMap.get(d.key)
                return colorScale(region!) as string
            })
            .attr("fill-opacity", 0.3)
            .attr("data-country", (d) => d.key)
            .attr("data-region", (d) => countryRegionMap.get(d.key)!)
            .attr("d", area)
            .attr("class", "income-plot-chart-area")
    }, [stackedSeries, area, countryRegionMap, colorScale])

    // Render Foreground Areas
    useEffect(() => {
        if (!foregroundAreasRef.current || !area || !stackedSeries.length)
            return

        const g = d3.select(foregroundAreasRef.current)

        g.selectAll("path")
            .data(stackedSeries)
            .join("path")
            .attr("fill", (d) => {
                const region = countryRegionMap.get(d.key)
                return colorScale(region!) as string
            })
            .attr("fill-opacity", (d) => {
                if (!hasHoveredEntity) return 0.8
                const region = countryRegionMap.get(d.key)
                if (d.key === hoveredEntity || region === hoveredEntity)
                    return 0.9
                return 0
            })
            .attr("data-country", (d) => d.key)
            .attr("data-region", (d) => countryRegionMap.get(d.key)!)
            .attr("d", area)
            .attr("class", "income-plot-chart-area--highlighted")
    }, [
        stackedSeries,
        area,
        countryRegionMap,
        colorScale,
        hasHoveredEntity,
        hoveredEntity,
    ])

    // Render X Axis
    useEffect(() => {
        if (!xAxisRef.current || !xScale) return

        const g = d3.select(xAxisRef.current)

        const [min, max] = xScale.domain()
        const xTicks: number[] = []
        for (
            let power = Math.floor(Math.log10(min));
            Math.pow(10, power) <= max;
            power++
        ) {
            const base = Math.pow(10, power)
            ;[1, 2, 3, 5].forEach((multiplier) => {
                const val = base * multiplier
                if (val >= min && val <= max) xTicks.push(val)
            })
        }

        const xAxis = d3
            .axisBottom(xScale)
            .tickValues(xTicks)
            .tickFormat((d) => formatCurrency(d as number, currentCurrency))
            .tickSizeOuter(0)

        g.call(xAxis)

        g.select(".domain").remove()
        g.selectAll(".tick line")
            .clone()
            .attr("y2", -(height - marginBottom - marginTop))
            .attr("stroke-opacity", 0.1)

        return () => void g.selectAll("*").remove()
    }, [xScale, height, marginBottom, marginTop, currentCurrency])

    const onMouseMove = useCallback(
        (event: MouseEvent) => {
            if (!xScale || !yScale || !stackedSeries.length || !svgRef.current)
                return

            const [mx, my] = d3.pointer(event, svgRef.current)
            const xVal = xScale.invert(mx) / combinedFactor
            const yVal = yScale.invert(my)

            // Find closest data point index
            const data = stackedSeries[0].map((d) => d.data)
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
        [
            xScale,
            yScale,
            stackedSeries,
            combinedFactor,
            setHoveredX,
            setHoveredEntity,
        ]
    )

    const onMouseLeave = useCallback(() => {
        setHoveredEntity(null)
        setHoveredX(null)
    }, [setHoveredEntity, setHoveredX])

    const onClick = useCallback(
        (event: MouseEvent) => {
            if (!xScale || !svgRef.current) return
            const [mx] = d3.pointer(event, svgRef.current)
            const xVal = xScale.invert(mx) / combinedFactor

            if (!showPovertyLine) {
                setPovertyLine(xVal)
            }
            setShowPovertyLine(!showPovertyLine)
        },
        [
            xScale,
            combinedFactor,
            showPovertyLine,
            setPovertyLine,
            setShowPovertyLine,
        ]
    )

    return (
        <div className="income-plot-chart">
            <svg
                ref={svgRef}
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                style={style}
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
                <g className="background-areas" ref={backgroundAreasRef} />
                <g
                    className="foreground-areas"
                    ref={foregroundAreasRef}
                    style={{
                        pointerEvents: "none",
                        clipPath: `url(#highlight-clip)`,
                    }}
                />
                <g
                    className="x-axis"
                    ref={xAxisRef}
                    transform={`translate(0,${height - marginBottom})`}
                />
                {/* Render poverty line, if enabled */}
                {showPovertyLine && xScale && (
                    <g className="poverty-line">
                        <line
                            x1={xScale(povertyLine * combinedFactor)}
                            x2={xScale(povertyLine * combinedFactor)}
                            y1={marginTop}
                            y2={height - marginBottom}
                            stroke="#d73027"
                            strokeWidth={2}
                            strokeDasharray="5,5"
                        />
                        <text
                            x={xScale(povertyLine * combinedFactor) + 5}
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
                            x1={xScale(hoveredX * combinedFactor)}
                            x2={xScale(hoveredX * combinedFactor)}
                            y1={marginTop}
                            y2={height - marginBottom}
                            stroke="red"
                            strokeOpacity={0.15}
                            style={{ pointerEvents: "none" }}
                        />
                        <text
                            x={xScale(hoveredX * combinedFactor)}
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
                    onMouseMove={onMouseMove}
                    onMouseLeave={onMouseLeave}
                    onClick={onClick}
                />
            </svg>
        </div>
    )
}
