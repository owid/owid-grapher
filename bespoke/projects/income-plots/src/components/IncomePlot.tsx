import { useEffect, useMemo, useRef } from "react"
import { useAtom, useAtomValue } from "jotai"
import * as d3 from "d3"
import { formatCurrency } from "../utils/incomePlotUtils.ts"
import {
    atomCombinedFactor,
    atomCurrentCurrency,
    atomCustomPovertyLine,
    atomHoveredEntity,
    atomHoveredX,
    atomKdeDataForYear,
    atomPlotColorScale,
    atomShowCustomPovertyLine,
} from "../store.ts"
import { PLOT_HEIGHT, PLOT_WIDTH } from "../utils/incomePlotConstants.ts"

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
    const points = useAtomValue(atomKdeDataForYear)
    const [povertyLine, setPovertyLine] = useAtom(atomCustomPovertyLine)
    const [showPovertyLine, setShowPovertyLine] = useAtom(
        atomShowCustomPovertyLine
    )
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
    const { stackedSeries, xScale, yScale } = useMemo(() => {
        if (!points.length)
            return {
                stackedSeries: [],
                xScale: null,
                yScale: null,
                xDomain: [],
            }

        // 1. Group by X and pivot
        // Assuming points are consistent across regions (same x grid)
        // We collect all unique X values first to be safe and sort them
        const xValues = Array.from(new Set(points.map((d) => d.x))).sort(
            (a, b) => a - b
        )

        // Create a map for quick lookup: x -> { region: y }
        const dataMap = new Map<number, { [key: string]: number }>()
        points.forEach((d) => {
            if (!dataMap.has(d.x)) dataMap.set(d.x, {})
            const regionMap = dataMap.get(d.x)!
            regionMap[d.region] = (regionMap[d.region] || 0) + d.y
        })

        const stackedDataInput = xValues.map((x) => {
            const row: any = { x }
            const regionValues = dataMap.get(x) || {}
            plotColorScaleConfig.domain.forEach((region) => {
                row[region] = regionValues[region] || 0
            })
            return row
        })

        // 2. Stack
        const stack = d3.stack().keys(plotColorScaleConfig.domain.toReversed())
        // .order(d3.stackOrderNone)
        // .offset(d3.stackOffsetNone)

        const stackedSeries = stack(stackedDataInput)

        // 3. Scales
        const xMin = d3.min(xValues, (d) => d * combinedFactor) || 0.1
        const xMax = d3.max(xValues, (d) => d * combinedFactor) || 100
        const xDomain = [Math.max(xMin, 0.1), xMax] // Log scale cannot have 0

        const xScale = d3
            .scaleLog()
            .domain(xDomain)
            .range([marginLeft, width - marginRight])

        // Max Y is the max of the sum of y's for any x (since it's stacked)
        const yMax =
            d3.max(stackedDataInput, (d) => {
                let sum = 0
                plotColorScaleConfig.domain.forEach((r) => (sum += d[r]))
                return sum
            }) || 1

        const yScale = d3
            .scaleLinear()
            .domain([0, yMax])
            .range([height - marginBottom, marginTop])

        return { stackedSeries, xScale, yScale, xDomain }
    }, [points, combinedFactor, plotColorScaleConfig, width, height])

    // Color Scale
    const colorScale = useMemo(() => {
        return d3
            .scaleOrdinal()
            .domain(plotColorScaleConfig.domain)
            .range(plotColorScaleConfig.range)
    }, [plotColorScaleConfig])

    const hoverRightThresholdPlaced = useMemo(() => {
        const activePovertyLine = showPovertyLine ? povertyLine : null
        const threshold = activePovertyLine ?? hoveredX
        if (!xScale) return null
        if (threshold !== null) return xScale(threshold * combinedFactor)
    }, [showPovertyLine, povertyLine, hoveredX, xScale, combinedFactor])

    // Render
    useEffect(() => {
        if (!svgRef.current || !xScale || !yScale || !stackedSeries.length)
            return

        const svg = d3.select(svgRef.current)
        svg.selectAll("*").remove() // Clear previous render

        // Area Generator
        const area = d3
            .area<any>()
            .x((d) => xScale(d.data.x * combinedFactor))
            .y0((d) => yScale(d[0]))
            .y1((d) => yScale(d[1]))

        // Draw Background Areas
        svg.append("g")
            .attr("class", "background-areas")
            .selectAll("path")
            .data(stackedSeries)
            .join("path")
            .attr("fill", (d) => colorScale(d.key) as string)
            .attr("fill-opacity", 0.3)
            .attr("data-region", (d) => d.key)
            .attr("d", area)
            .attr("class", "income-plot-chart-area")

        // Draw Foreground Areas (Highlighted)
        const foregroundGroup = svg
            .append("g")
            .attr("class", "foreground-areas")
            .style("pointer-events", "none")
            .attr("clip-path", "url(#highlight-clip)")

        foregroundGroup
            .selectAll("path")
            .data(stackedSeries)
            .join("path")
            .attr("fill", (d) => colorScale(d.key) as string)
            .attr("fill-opacity", (d) => {
                if (!hasHoveredEntity) return 0.8
                return d.key === hoveredEntity ? 0.9 : 0
            })
            .attr("data-region", (d) => d.key)
            .attr("d", area)
            .attr("class", "income-plot-chart-area--highlighted")

        // X Axis Ticks: we only want to label "nice" values like 1, 2, 3, 5, 10, 20, 50, etc.
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

        const xAxisGroup = svg
            .append("g")
            .attr("transform", `translate(0,${height - marginBottom})`)
            .call(xAxis)

        xAxisGroup.select(".domain").remove()
        xAxisGroup
            .selectAll(".tick line")
            .clone()
            .attr("y2", -(height - marginBottom - marginTop))
            .attr("stroke-opacity", 0.1)

        // Poverty Line
        if (showPovertyLine) {
            const x = xScale(povertyLine * combinedFactor)

            svg.append("line")
                .attr("x1", x)
                .attr("x2", x)
                .attr("y1", marginTop)
                .attr("y2", height - marginBottom)
                .attr("stroke", "#d73027")
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", "5,5")

            svg.append("text")
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

        // Pointer X
        if (hoveredX !== null) {
            const x = xScale(hoveredX * combinedFactor)

            svg.append("line")
                .attr("x1", x)
                .attr("x2", x)
                .attr("y1", marginTop)
                .attr("y2", height - marginBottom)
                .attr("stroke", "red")
                .attr("stroke-opacity", 0.15)
                .style("pointer-events", "none")

            svg.append("text")
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

        // Interactions
        // We use a transparent overlay rect to capture events everywhere
        const overlay = svg
            .append("rect")
            .attr("class", "overlay")
            .attr("x", marginLeft)
            .attr("y", marginTop)
            .attr("width", width - marginLeft - marginRight)
            .attr("height", height - marginBottom - marginTop)
            .attr("fill", "transparent")
        // .style("cursor", "crosshair")

        overlay.on("mousemove", (event) => {
            const [mx, my] = d3.pointer(event)
            const xVal = xScale.invert(mx) / combinedFactor
            const yVal = yScale.invert(my)

            // Find closest data point index
            // stackedSeries[0] has the data structure with .data.x
            const data = stackedSeries[0].map((d) => d.data)
            const bisect = d3.bisector((d: any) => d.x).center
            const index = bisect(data, xVal)

            if (index >= 0 && index < data.length) {
                const d = data[index]
                setHoveredX(d.x) // Set raw x

                // Find region
                let foundRegion = null
                // Iterate series in reverse order (top to bottom) or just check intervals
                for (const layer of stackedSeries) {
                    const [y0, y1] = layer[index]
                    // y0 and y1 are data values. yScale maps them to pixels.
                    // yVal is data value (inverted from pixels).
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
        stackedSeries,
        xScale,
        yScale,
        width,
        height,
        combinedFactor,
        currentCurrency,
        colorScale,
        showPovertyLine,
        povertyLine,
        hoveredX,
        hasHoveredEntity,
        hoveredEntity,
        setHoveredEntity,
        setHoveredX,
        setPovertyLine,
        setShowPovertyLine,
    ])

    useEffect(() => {
        if (!svgRef.current) return
        const svg = d3.select(svgRef.current)

        const clipPathWidth = hoverRightThresholdPlaced ?? width

        // Define Clip Path for Highlight
        const defs = svg.append("defs")
        const clipPath = defs.append("clipPath").attr("id", "highlight-clip")
        clipPath
            .append("rect")
            .attr("y", 0)
            .attr("height", height)
            .attr("width", clipPathWidth)

        return () => void svg.select("defs").remove()
    }, [hoverRightThresholdPlaced, width, height])

    return (
        <div className="income-plot-chart" ref={containerRef}>
            <svg ref={svgRef} width={width} height={height} style={style} />
        </div>
    )
}
