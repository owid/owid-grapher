import {
    MouseEvent,
    PointerEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
} from "react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import * as d3 from "d3"
import { formatCurrency } from "../utils/incomePlotUtils.ts"
import {
    atomCombinedFactor,
    atomCountriesOrRegionsMode,
    atomCountryRegionMap,
    atomCurrentCurrency,
    atomCustomPovertyLine,
    atomCustomPovertyLineFormatted,
    atomHoveredEntity,
    atomHoveredEntityType,
    atomHoveredX,
    atomKdeDataForYear,
    atomKdeXValues,
    atomIsInSingleCountryMode,
    atomSelectedCountryNames,
    atomShowCustomPovertyLine,
    atomEntityColorMap,
} from "../store.ts"
import {
    INT_POVERTY_LINE,
    StackedSeriesPoint,
} from "../utils/incomePlotConstants.ts"
import * as R from "remeda"
import { IncomePlotTooltip } from "./IncomePlotTooltip.tsx"
import { IncomePlotLegend } from "./IncomePlotLegend.tsx"

const style = {
    fontFamily:
        'Lato, "Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif',
    fontSize: "13px",
    maxWidth: "100%",
    display: "block",
}

const LABEL_FONT_SIZES = [13, 12, 11, 10, 9] as const
const CHAR_WIDTH_RATIO = 0.4 // approximate char width as fraction of font size

interface IncomePlotProps {
    aspectRatio?: number
    width: number
    isNarrow?: boolean
}

interface IncomePlotClipPathProps {
    xScale: d3.ScaleLogarithmic<number, number> | null
}

const IncomePlotClipPath = ({ xScale }: IncomePlotClipPathProps) => {
    const povertyLine = useAtomValue(atomCustomPovertyLine)
    const hoveredX = useAtomValue(atomHoveredX)
    const hoverRightThresholdPlaced = useMemo(() => {
        const threshold = povertyLine ?? hoveredX
        if (!xScale || threshold === null) return null
        return xScale(threshold)
    }, [povertyLine, hoveredX, xScale])
    return (
        <defs>
            <clipPath id="highlight-clip">
                <rect
                    x="0"
                    y="0"
                    width={hoverRightThresholdPlaced ?? "100%"}
                    height={"100%"}
                />
            </clipPath>
        </defs>
    )
}

interface IncomePlotAreasProps {
    xScale: d3.ScaleLogarithmic<number, number> | null
    height: number
}

const IncomePlotAreasStacked = ({ xScale, height }: IncomePlotAreasProps) => {
    const ref = useRef<SVGGElement>(null)

    const points = useAtomValue(atomKdeDataForYear)
    const xValues = useAtomValue(atomKdeXValues)
    const countryRegionMap = useAtomValue(atomCountryRegionMap)
    const countriesOrRegionsMode = useAtomValue(atomCountriesOrRegionsMode)
    const selectedCountryNames: string[] = [] // Country selection is disabled for stacked mode for now
    const [hoveredEntity, setHoveredEntity] = useAtom(atomHoveredEntity)
    const hoveredEntityType = useAtomValue(atomHoveredEntityType)
    const entityColors = useAtomValue(atomEntityColorMap)

    // Prepare Data for Stack
    const stackedSeries = useMemo(() => {
        // 1. Group by X and pivot
        // Create a map for quick lookup: x -> { country: y }
        const dataMap = new Map<number, { [key: string]: number }>()
        points.forEach((d) => {
            if (!dataMap.has(d.x)) dataMap.set(d.x, {})
            const xMap = dataMap.get(d.x)!
            xMap[d.country] = d.yScaledByPop
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
            series.country = series.key
            series.region = countryRegionMap.get(series.key)!
            series.color = entityColors.get(series.region)!
        })

        return stackedSeries as unknown as StackedSeriesPoint[]
    }, [points, countryRegionMap, xValues, entityColors])

    const yMax = useMemo(() => {
        return d3.max(stackedSeries, (series) => d3.max(series, (d) => d[1]))!
    }, [stackedSeries])

    const yScale = useMemo(() => {
        if (!xScale) return null
        return d3
            .scaleLinear()
            .domain([0, yMax])
            .range([height - 30, 30])
    }, [height, xScale, yMax])

    // Area Generator
    const area = useMemo(() => {
        if (!xScale || !yScale) return null
        return d3
            .area<any>()
            .x((d) => xScale(d.data.x))
            .y0((d) => yScale(d[0]))
            .y1((d) => yScale(d[1]))
    }, [xScale, yScale])

    const regionStackedData = useMemo(() => {
        // Re-stack the already stacked data by regions.
        // We need to compute this even when we are in country mode, so that we have this data available for `regionLabels` below.
        const grouped = R.groupBy(stackedSeries, (d) => d.region)
        return Object.values(grouped).map((dataForRegion) => {
            const first = R.first(dataForRegion)
            const last = R.last(dataForRegion)

            const combined = R.zip(first, last).map(([f, l]) => {
                const arr = [f[0], l[1]] as d3.SeriesPoint<{ x: number }>
                arr.data = f.data
                return arr
            }) as StackedSeriesPoint

            combined.key = first.region
            combined.region = first.region
            combined.color = first.color

            return combined
        })
    }, [stackedSeries])

    const stackedData = useMemo(
        () =>
            countriesOrRegionsMode === "countries"
                ? stackedSeries
                : regionStackedData,
        [countriesOrRegionsMode, stackedSeries, regionStackedData]
    )

    const seriesWithAreas = useMemo(() => {
        if (!area) return []
        return stackedData.map((series) => ({
            ...series,
            area: area(series),
        }))
    }, [area, stackedData])

    /**
     * Marcel here: The following code is for placing region labels inside the areas. It was implemented by Claude Code and I don't fully understand it. Be careful!
     */

    // Place region name labels inside each stacked area.
    //
    // We find the best label position using a weighted "pole of inaccessibility":
    // 1. Build the boundary polygon of each region area in pixel space
    // 2. Scale x-coordinates by 1/aspectRatio (where aspectRatio = text width /
    //    text height). In this compressed space, finding the largest inscribed
    //    circle is equivalent to finding the largest inscribed oval with the
    //    text's aspect ratio in the original space.
    // 3. Build a Delaunay triangulation of the scaled boundary points for fast
    //    nearest-neighbor lookups
    // 4. Test a grid of candidate points; for each, query the Delaunay to get
    //    the distance to the nearest boundary in scaled space
    // 5. The candidate with the maximum distance is the center of the largest
    //    inscribed text-shaped rectangle
    //
    // The bestDist in scaled space directly determines the max font size:
    // in original space it corresponds to half-height = bestDist and
    // half-width = bestDist * textAspect. Since text at font size f needs
    // half-height f/2, the max font is 2 * bestDist (with a comfort margin).
    const regionLabels = useMemo(() => {
        if (!xScale || !yScale) return []

        // Convert each series' data coordinates to pixel space once up front
        const seriesPixelData = regionStackedData.map((series) => {
            return series.map((point) => ({
                x: xScale(point.data.x),
                top: yScale(point[1]), // upper edge (smaller y = higher on screen)
                bot: yScale(point[0]), // lower edge
            }))
        })

        return regionStackedData.map((series, seriesIdx) => {
            const n = series.length
            const pxData = seriesPixelData[seriesIdx]
            const regionName = series.region ?? series.key

            // The text's aspect ratio (width/height) determines how we weight
            // horizontal vs vertical distances. This ratio is font-size-
            // independent since both dimensions scale linearly with font size.
            const textAspect = regionName.length * CHAR_WIDTH_RATIO
            // Compressing x by this factor transforms the problem so that
            // Euclidean distance in the scaled space corresponds to how well
            // a text-shaped rectangle fits in the original space.
            const xShrink = 1 / textAspect

            // Build the boundary polygon in scaled space: trace the top edge
            // left-to-right, then the bottom edge right-to-left.
            // We subdivide each edge segment so that vertex spacing in
            // scaled space is at most MAX_SEG_LEN px. This ensures that
            // "nearest vertex" closely approximates "nearest edge".
            const MAX_SEG_LEN = 4
            const boundaryPoints: number[] = []

            const addSubdividedEdge = (
                points: typeof pxData,
                getY: (p: (typeof pxData)[0]) => number
            ) => {
                for (let i = 0; i < points.length - 1; i++) {
                    const x0 = points[i].x * xShrink
                    const y0 = getY(points[i])
                    const x1 = points[i + 1].x * xShrink
                    const y1 = getY(points[i + 1])
                    const segLen = Math.hypot(x1 - x0, y1 - y0)
                    const subdivisions = Math.max(
                        1,
                        Math.ceil(segLen / MAX_SEG_LEN)
                    )
                    for (let s = 0; s < subdivisions; s++) {
                        const t = s / subdivisions
                        boundaryPoints.push(
                            x0 + t * (x1 - x0),
                            y0 + t * (y1 - y0)
                        )
                    }
                }
                // Add the last point
                const last = points[points.length - 1]
                boundaryPoints.push(last.x * xShrink, getY(last))
            }

            // Top edge left-to-right
            addSubdividedEdge(pxData, (p) => p.top)
            // Bottom edge right-to-left
            addSubdividedEdge([...pxData].reverse(), (p) => p.bot)

            const scaledCoords = new Float64Array(boundaryPoints)

            // Build Delaunay on the scaled boundary so that nearest-neighbor
            // queries reflect the text's aspect ratio
            const delaunay = new d3.Delaunay(scaledCoords)

            // Search an 50×40 grid of candidate points inside the region.
            // For each candidate, find the weighted distance to the nearest
            // boundary point and keep track of the maximum.
            let bestPoint: [number, number] | null = null
            let bestDistSq = 0 // squared distance (avoids sqrt in inner loop)

            const GRID_X = 50
            const GRID_Y = 40

            for (let gx = 1; gx < GRID_X; gx++) {
                // Interpolate between data points to get the x position and
                // the top/bottom edges of the region at this grid column
                const t = gx / GRID_X
                const idx = t * (n - 1)
                const i0 = Math.floor(idx)
                const i1 = Math.min(i0 + 1, n - 1)
                const frac = idx - i0

                const topPx =
                    pxData[i0].top * (1 - frac) + pxData[i1].top * frac
                const botPx =
                    pxData[i0].bot * (1 - frac) + pxData[i1].bot * frac
                const px = pxData[i0].x * (1 - frac) + pxData[i1].x * frac

                // Skip very thin slices of the region
                const height = botPx - topPx
                if (height <= 10) continue

                // Query the Delaunay in scaled x-space
                const scaledPx = px * xShrink

                for (let gy = 1; gy < GRID_Y; gy++) {
                    const py = topPx + (gy / GRID_Y) * height

                    // Find nearest boundary point in scaled space
                    const nearestIdx = delaunay.find(scaledPx, py)
                    const dx = scaledPx - scaledCoords[nearestIdx * 2]
                    const dy = py - scaledCoords[nearestIdx * 2 + 1]
                    const distSq = dx * dx + dy * dy

                    if (distSq > bestDistSq) {
                        bestDistSq = distSq
                        bestPoint = [px, py]
                    }
                }
            }

            // bestDist (in scaled space) is the radius of the largest
            // inscribed circle. The max font size that fits is 2 * bestDist,
            // reduced by a comfort margin (0.65) to ensure breathing room.
            const bestDist = Math.sqrt(bestDistSq)
            const maxFont = bestDist * 2 * 0.65
            const chosenFontSize = LABEL_FONT_SIZES.find((f) => f <= maxFont)

            return {
                region: regionName,
                point: bestPoint,
                fontSize: chosenFontSize,
                color: series.color,
            }
        })
    }, [regionStackedData, xScale, yScale])

    const onMouseLeave = useCallback(
        (entity: string) => {
            // Only set to null if it hasn't been changed in the meantime
            setHoveredEntity((current) => (current === entity ? null : current))
        },
        [setHoveredEntity]
    )

    return (
        <g className="plot-series-stacked" ref={ref}>
            {seriesWithAreas.map((series) => {
                if (!series.area) return null
                const isHighlighted =
                    hoveredEntityType === null
                        ? undefined
                        : series[hoveredEntityType] === hoveredEntity

                const isSelected =
                    series.country &&
                    selectedCountryNames.includes(series.country)
                        ? true
                        : undefined

                const entityName =
                    countriesOrRegionsMode === "countries"
                        ? series.country
                        : series.region

                return (
                    <g
                        key={entityName}
                        className="income-plot-series"
                        data-country={series.country}
                        data-region={series.region}
                        data-selected={isSelected}
                        data-highlighted={isHighlighted}
                        onMouseEnter={() =>
                            entityName && setHoveredEntity(entityName)
                        }
                        onMouseLeave={() =>
                            entityName && onMouseLeave(entityName)
                        }
                    >
                        <path
                            className="area-bg"
                            fill={series.color}
                            d={series.area}
                            strokeWidth={0.1}
                            stroke="white"
                        />
                        <path
                            className="area-fg"
                            fill={series.color}
                            d={series.area}
                            clipPath="url(#highlight-clip)"
                            style={{ pointerEvents: "none" }}
                            strokeWidth={0.1}
                            stroke="white"
                        />
                    </g>
                )
            })}
            {regionLabels.map((label) => {
                if (!label.point || !label.fontSize) return null
                return (
                    <text
                        key={label.region}
                        className="region-label"
                        x={label.point[0]}
                        y={label.point[1]}
                        fontSize={label.fontSize}
                    >
                        {label.region}
                    </text>
                )
            })}
        </g>
    )
}

const IncomePlotAreasUnstacked = ({ xScale, height }: IncomePlotAreasProps) => {
    const ref = useRef<SVGGElement>(null)

    const points = useAtomValue(atomKdeDataForYear)
    const countryRegionMap = useAtomValue(atomCountryRegionMap)
    const countriesOrRegionsMode = useAtomValue(atomCountriesOrRegionsMode)
    const selectedCountryNames = useAtomValue(atomSelectedCountryNames)
    const [hoveredEntity, setHoveredEntity] = useAtom(atomHoveredEntity)
    const hoveredEntityType = useAtomValue(atomHoveredEntityType)
    const entityColors = useAtomValue(atomEntityColorMap)

    // Prepare Data for Stack
    const filteredData = points.filter((d) =>
        selectedCountryNames.includes(d.country)
    )

    const yMax = useMemo(
        () => d3.max(filteredData, (d) => d.y) || 0,
        [filteredData]
    )

    const groupedData = useMemo(() => {
        return d3.group(filteredData, (d) => d.country)
    }, [filteredData])

    const yScale = useMemo(() => {
        if (!xScale) return null
        return d3
            .scaleLinear()
            .domain([0, yMax])
            .range([height - 30, 30])
    }, [xScale, yMax, height])

    // Area Generator
    const area = useMemo(() => {
        if (!xScale || !yScale) return null
        return d3
            .area<any>()
            .x((d) => xScale(d.x))
            .y0(yScale(0))
            .y1((d) => yScale(d.y))
    }, [xScale, yScale])

    const seriesWithAreas = useMemo(() => {
        if (!area) return []
        return Array.from(groupedData).map(([country, points]) => {
            const region = countryRegionMap.get(country) ?? ""
            return {
                country,
                region,
                color: entityColors.get(country),
                area: area(points),
            }
        })
    }, [area, groupedData, countryRegionMap, entityColors])

    const onMouseLeave = useCallback(
        (entity: string) => {
            // Only set to null if it hasn't been changed in the meantime
            setHoveredEntity((current) => (current === entity ? null : current))
        },
        [setHoveredEntity]
    )

    return (
        <g className="plot-series-unstacked" ref={ref}>
            {seriesWithAreas.map((series) => {
                if (!series.area) return null
                const isHighlighted =
                    hoveredEntityType === null
                        ? undefined
                        : series[hoveredEntityType] === hoveredEntity

                const entityName =
                    countriesOrRegionsMode === "countries"
                        ? series.country
                        : series.region

                return (
                    <g
                        key={entityName}
                        className="income-plot-series"
                        data-country={series.country}
                        data-region={series.region}
                        data-highlighted={isHighlighted}
                        onMouseEnter={() =>
                            entityName && setHoveredEntity(entityName)
                        }
                        onMouseLeave={() =>
                            entityName && onMouseLeave(entityName)
                        }
                    >
                        <path
                            className="area-bg"
                            fill={series.color}
                            d={series.area}
                            strokeWidth={1}
                            strokeOpacity={0.6}
                            stroke={series.color}
                        />
                        <path
                            className="area-fg"
                            fill={series.color}
                            d={series.area}
                            clipPath="url(#highlight-clip)"
                            style={{ pointerEvents: "none" }}
                            strokeWidth={1}
                            stroke={series.color}
                        />
                    </g>
                )
            })}
        </g>
    )
}

interface IncomePlotXAxisProps {
    xScale: d3.ScaleLogarithmic<number, number> | null
    height: number
    marginBottom: number
    marginTop: number
    isNarrow?: boolean
}

const IncomePlotXAxis = ({
    xScale,
    height,
    marginBottom,
    marginTop,
    isNarrow,
}: IncomePlotXAxisProps) => {
    const xAxisRef = useRef<SVGGElement>(null)

    const currentCurrency = useAtomValue(atomCurrentCurrency)
    const combinedFactor = useAtomValue(atomCombinedFactor)

    useEffect(() => {
        if (!xAxisRef.current || !xScale) return

        const g = d3.select(xAxisRef.current)
        const tickMarkPoints = [1, 2, 3, 4, 5, 6, 7, 8, 9]
        const tickMarkPointsToDisplay = isNarrow ? [1, 3] : [1, 2, 3, 5]

        const [min, max] = xScale.domain()

        // Mapping from tick value to whether the label should be shown on the axis
        const xTicks: Map<number, boolean> = new Map()
        for (
            let power = Math.floor(Math.log10(min * combinedFactor));
            Math.pow(10, power) <= max * combinedFactor;
            power++
        ) {
            const base = Math.pow(10, power)
            tickMarkPoints.forEach((multiplier) => {
                const val = (base * multiplier) / combinedFactor
                if (val >= min && val <= max)
                    xTicks.set(
                        val,
                        tickMarkPointsToDisplay.includes(multiplier)
                    )
            })
        }

        const xAxis = d3
            .axisBottom(xScale)
            .tickValues(Array.from(xTicks.keys()))
            .tickFormat((d) => {
                const shouldShowLabel = xTicks.get(d as number) ?? false
                if (!shouldShowLabel) return ""
                return formatCurrency(
                    (d as number) * combinedFactor,
                    currentCurrency,
                    { formatShort: true }
                )
            })
            .tickSizeOuter(0)

        g.call(xAxis)

        g.select(".domain").remove()

        // Add grid lines for ticks that have labels
        g.selectAll<SVGGElement, number>(".tick")
            .filter((d) => xTicks.get(d) === true)
            .select("line")
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
        isNarrow,
    ])

    return (
        <g
            className="x-axis"
            ref={xAxisRef}
            transform={`translate(0,${height - marginBottom})`}
        />
    )
}

interface IncomePlotIntPovertyLineProps {
    xScale: d3.ScaleLogarithmic<number, number> | null
    marginTop: number
    height: number
    marginBottom: number
}

const IncomePlotIntPovertyLine = ({
    xScale,
    marginTop,
    height,
    marginBottom,
}: IncomePlotIntPovertyLineProps) => {
    const combinedFactor = useAtomValue(atomCombinedFactor)
    const currentCurrency = useAtomValue(atomCurrentCurrency)

    if (!xScale) return null

    const povertyLine = INT_POVERTY_LINE
    const x = xScale(povertyLine)

    const povertyLineText = `International poverty line: ${formatCurrency(
        povertyLine * combinedFactor,
        currentCurrency as any
    )}`

    return (
        <g className="poverty-line" style={{ pointerEvents: "none" }}>
            <line
                x1={x}
                x2={x}
                y1={marginTop}
                y2={height - marginBottom}
                stroke="#a9a9a9"
                strokeWidth={1}
                strokeOpacity={0.8}
                strokeDasharray="3,4"
            />
            <text
                fill="#a9a9a9"
                transform={`translate(${x + 5}, ${marginTop + 2}) rotate(90)`}
                textAnchor="start"
                fontSize={10}
            >
                {povertyLineText}
            </text>
        </g>
    )
}

interface IncomePlotCustomPovertyLineProps {
    xScale: d3.ScaleLogarithmic<number, number> | null
    marginTop: number
    height: number
    marginBottom: number
}

const IncomePlotCustomPovertyLine = ({
    xScale,
    marginTop,
    height,
    marginBottom,
}: IncomePlotCustomPovertyLineProps) => {
    const povertyLine = useAtomValue(atomCustomPovertyLine)
    const povertyLineFormatted = useAtomValue(atomCustomPovertyLineFormatted)

    if (!xScale || povertyLine === null || povertyLineFormatted === null)
        return null

    return (
        <g className="poverty-line" style={{ pointerEvents: "none" }}>
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
                {`Poverty line: ${povertyLineFormatted}`}
            </text>
        </g>
    )
}

interface IncomePlotPointerProps {
    xScale: d3.ScaleLogarithmic<number, number> | null
    marginTop: number
    height: number
    marginBottom: number
}

const IncomePlotPointer = ({
    xScale,
    marginTop,
    height,
    marginBottom,
}: IncomePlotPointerProps) => {
    const hoveredX = useAtomValue(atomHoveredX)
    const combinedFactor = useAtomValue(atomCombinedFactor)
    const currentCurrency = useAtomValue(atomCurrentCurrency)

    if (!xScale || hoveredX === null) return null
    return (
        <g className="pointer" style={{ pointerEvents: "none" }}>
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
                    currentCurrency as any
                )}
            </text>
        </g>
    )
}

export function IncomePlot({
    aspectRatio = 1,
    isNarrow = false,
    width,
}: IncomePlotProps) {
    const svgRef = useRef<SVGSVGElement>(null)

    const setPovertyLine = useSetAtom(atomCustomPovertyLine)
    const setShowPovertyLine = useSetAtom(atomShowCustomPovertyLine)
    const xValues = useAtomValue(atomKdeXValues)
    const setHoveredEntity = useSetAtom(atomHoveredEntity)
    const setHoveredX = useSetAtom(atomHoveredX)
    const isSingleCountryMode = useAtomValue(atomIsInSingleCountryMode)

    // Margins
    const marginTop = 10
    const marginRight = 20
    const marginBottom = 30
    const marginLeft = 20

    const plotWidth = Math.min(width, 1000)
    const plotHeight = plotWidth / aspectRatio

    const xScale = useMemo(() => {
        const xMin = R.first(xValues)
        const xMax = R.last(xValues)
        const xDomain = [xMin, xMax]

        const xScale = d3
            .scaleLog()
            .domain(xDomain)
            .range([marginLeft, plotWidth - marginRight])
        return xScale
    }, [xValues, plotWidth])

    const onPointerMove = useCallback(
        (event: PointerEvent) => {
            if (!xScale || !svgRef.current) return

            // Don't show tooltip or hover line for touch events
            if (event.pointerType === "touch") return

            const [mx] = d3.pointer(event, svgRef.current)
            const xVal = xScale.invert(mx)
            setHoveredX(xVal)
        },
        [xScale, setHoveredX]
    )

    const onPointerLeave = useCallback(() => {
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
        <>
            <div
                className="income-plot-chart"
                style={{
                    position: "relative",
                    maxWidth: "100%",
                }}
            >
                {!isNarrow && <IncomePlotLegend isNarrow={false} />}
                <svg
                    ref={svgRef}
                    className="income-plot-chart-svg"
                    width={plotWidth}
                    viewBox={`0 0 ${plotWidth} ${plotHeight}`}
                    style={style}
                    onPointerMove={onPointerMove}
                    onPointerLeave={onPointerLeave}
                    onClick={onClick}
                >
                    <IncomePlotClipPath xScale={xScale} />
                    <IncomePlotXAxis
                        xScale={xScale}
                        height={plotHeight}
                        marginBottom={marginBottom}
                        marginTop={marginTop}
                        isNarrow={isNarrow}
                    />
                    {isSingleCountryMode ? (
                        <IncomePlotAreasUnstacked
                            xScale={xScale}
                            height={plotHeight}
                        />
                    ) : (
                        <IncomePlotAreasStacked
                            xScale={xScale}
                            height={plotHeight}
                        />
                    )}
                    <IncomePlotIntPovertyLine
                        xScale={xScale}
                        marginTop={marginTop}
                        height={plotHeight}
                        marginBottom={marginBottom}
                    />
                    <IncomePlotCustomPovertyLine
                        xScale={xScale}
                        marginTop={marginTop}
                        height={plotHeight}
                        marginBottom={marginBottom}
                    />
                    <IncomePlotPointer
                        xScale={xScale}
                        marginTop={marginTop}
                        height={plotHeight}
                        marginBottom={marginBottom}
                    />
                </svg>
                <IncomePlotTooltip />
            </div>
            {isNarrow && <IncomePlotLegend isNarrow={true} />}
        </>
    )
}
