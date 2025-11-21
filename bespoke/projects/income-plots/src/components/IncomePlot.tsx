import { useEffect, useMemo, useRef } from "react"
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
}

interface IncomePlotProps {
    width?: number
    height?: number
}

export function IncomePlot({
    width = PLOT_WIDTH,
    height = PLOT_HEIGHT,
}: IncomePlotProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const svgRef = useRef<SVGSVGElement>(null)
    const backgroundAreasRef = useRef<SVGGElement>(null)
    const foregroundAreasRef = useRef<SVGGElement>(null)
    const xAxisRef = useRef<SVGGElement>(null)
    const povertyLineRef = useRef<SVGGElement>(null)
    const pointerRef = useRef<SVGGElement>(null)
    const overlayRef = useRef<SVGRectElement>(null)
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

        g.style("pointer-events", "none").attr(
            "clip-path",
            "url(#highlight-clip)"
        )

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
        g.attr("transform", `translate(0,${height - marginBottom})`)

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
    }, [xScale, height, marginBottom, marginTop, currentCurrency])

    // Render Poverty Line
    useEffect(() => {
        if (!povertyLineRef.current || !xScale) return
        const g = d3.select(povertyLineRef.current)
        g.selectAll("*").remove()

        if (showPovertyLine) {
            const x = xScale(povertyLine * combinedFactor)

            g.append("line")
                .attr("x1", x)
                .attr("x2", x)
                .attr("y1", marginTop)
                .attr("y2", height - marginBottom)
                .attr("stroke", "#d73027")
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", "5,5")

            g.append("text")
                .attr("x", x + 5)
                .attr("y", marginTop + 10)
                .attr("fill", "#d73027")
                .attr("font-weight", "bold")
                .style("font-family", style.fontFamily)
                .style("font-size", style.fontSize)
                .text(
                    `Poverty line: ${formatCurrency(povertyLine * combinedFactor, currentCurrency)}`
                )
        }
    }, [
        showPovertyLine,
        povertyLine,
        combinedFactor,
        currentCurrency,
        xScale,
        height,
        marginBottom,
        marginTop,
    ])

    // Render Pointer
    useEffect(() => {
        if (!pointerRef.current || !xScale) return
        const g = d3.select(pointerRef.current)
        g.selectAll("*").remove()

        if (hoveredX !== null) {
            const x = xScale(hoveredX * combinedFactor)

            g.append("line")
                .attr("x1", x)
                .attr("x2", x)
                .attr("y1", marginTop)
                .attr("y2", height - marginBottom)
                .attr("stroke", "red")
                .attr("stroke-opacity", 0.15)
                .style("pointer-events", "none")

            g.append("text")
                .attr("x", x)
                .attr("y", height - marginBottom + 9)
                .attr("dy", "0.71em") // approximate alignment
                .attr("fill", "red")
                .attr("stroke", "white")
                .attr("stroke-width", 3)
                .attr("paint-order", "stroke")
                .attr("text-anchor", "middle")
                .style("font-family", style.fontFamily)
                .style("font-size", style.fontSize)
                .text(
                    formatCurrency(hoveredX * combinedFactor, currentCurrency)
                )
        }
    }, [
        hoveredX,
        combinedFactor,
        currentCurrency,
        xScale,
        height,
        marginBottom,
        marginTop,
    ])

    // Interactions
    useEffect(() => {
        if (!overlayRef.current || !xScale || !yScale || !stackedSeries.length)
            return

        const overlay = d3.select(overlayRef.current)

        overlay.on("mousemove", (event) => {
            const [mx, my] = d3.pointer(event)
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
        })

        overlay.on("mouseleave", () => {
            setHoveredEntity(null)
            setHoveredX(null)
        })

        overlay.on("click", (event) => {
            const [mx] = d3.pointer(event)
            const xVal = xScale.invert(mx) / combinedFactor

            if (!showPovertyLine) {
                setPovertyLine(xVal)
            }
            setShowPovertyLine(!showPovertyLine)
        })
    }, [
        xScale,
        yScale,
        stackedSeries,
        combinedFactor,
        showPovertyLine,
        setPovertyLine,
        setShowPovertyLine,
        setHoveredX,
        setHoveredEntity,
    ])

    return (
        <div className="income-plot-chart" ref={containerRef}>
            <svg ref={svgRef} width={width} height={height} style={style}>
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
                <g className="foreground-areas" ref={foregroundAreasRef} />
                <g className="x-axis" ref={xAxisRef} />
                <g className="poverty-line" ref={povertyLineRef} />
                <g className="pointer" ref={pointerRef} />
                <rect
                    ref={overlayRef}
                    className="overlay"
                    x={marginLeft}
                    y={marginTop}
                    width={width - marginLeft - marginRight}
                    height={height - marginTop - marginBottom}
                    fill="transparent"
                />
            </svg>
        </div>
    )
}
