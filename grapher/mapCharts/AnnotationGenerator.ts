import { PointVector } from "../../clientUtils/PointVector.js"
import pixelWidth from "string-pixel-width"
import {
    ChoroplethSeries,
    Annotation,
    AnnotationsCache,
    RenderFeature,
    Region,
    InternalInfo,
    CoastPositions,
    CalculatedPosition,
    MIN_INTERNAL_ANNOTATION_SIZE,
    MAX_INTERNAL_ANNOTATION_SIZE,
    EXTERNAL_ANNOTATION_SIZE,
} from "./MapChartConstants.js"
import { MapProjectionName } from "./MapProjections.js"
import { geoPath } from "d3-geo"
import polylabel from "polylabel"
import { Position } from "geojson"
import { Bounds } from "../../clientUtils/Bounds.js"

enum ExternalDirections {
    right = "right",
    left = "left",
    topRight = "topRight",
    bottomRight = "bottomRight",
    topLeft = "topLeft",
    bottomLeft = "bottomLeft",
    bottom = "bottom",
    top = "top",
}

interface ExternalInfo {
    id: string
    region: Position[]
    area: number
    pole: Position
    regionPoints: Position[]
}

let globalScale: number

export function generateAnnotations(
    featureData: RenderFeature[],
    featuresWithNoData: RenderFeature[],
    choroplethData: Map<string, ChoroplethSeries>,
    viewportScale: number,
    offset: number[],
    bounds: Bounds,
    projection: MapProjectionName,
    annotationsCache: Map<MapProjectionName, AnnotationsCache>
): Annotation[] {
    const combinedData = [...featureData, ...featuresWithNoData]
    if (!annotationsCache.has(projection)) {
        const projectionCache = {
            coastPositions: [],
            calculatedPositions: [],
            regions: [],
            internalInfo: [],
            allPoints: {},
        }
        annotationsCache.set(projection, projectionCache)
        setAnnotationCache(combinedData, projection, annotationsCache)
    }
    globalScale = viewportScale
    const regionsCache: Region[] = annotationsCache.get(projection)!.regions
    const coastPositionsCache: CoastPositions[] =
        annotationsCache.get(projection)!.coastPositions
    const calculatedPositionsCache: CalculatedPosition[] =
        annotationsCache.get(projection)!.calculatedPositions
    const topLeftBound = [
        (bounds.x - offset[0]) / viewportScale,
        (bounds.y - offset[1]) / viewportScale,
    ]
    const bottomRightBound = [
        (bounds.x - offset[0] + bounds.width) / viewportScale,
        (bounds.y - offset[1] + bounds.height) / viewportScale,
    ]
    const externalLabels: Position[][] = []
    const markers: Position[][] = []
    const internalAnnotations = internalGenerator(
        featureData,
        choroplethData,
        viewportScale,
        projection,
        annotationsCache
    )
    const allAnnotations: Annotation[] = internalAnnotations.internalAnnotations
    internalAnnotations.externalInfo.sort((a, b) => b.area - a.area)
    for (const country of internalAnnotations.externalInfo) {
        const fontSize = EXTERNAL_ANNOTATION_SIZE / viewportScale
        const value = choroplethData.get(country.id)!.shortValue!
        let h = null
        const textWidth = pixelWidth(value.toString(), {
            size: fontSize,
            font: "arial",
        })
        if (
            coastPositionsCache.find((el) => el.id === country.id) === undefined
        )
            getCoastPositions(country, projection, annotationsCache)
        const coastPositions = coastPositionsCache.find(
            (el) => el.id === country.id
        ) as CoastPositions
        for (const pos in coastPositions.positions) {
            const ch = externalCheck(
                coastPositions.positions[pos],
                regionsCache,
                pos,
                textWidth,
                fontSize,
                country,
                combinedData,
                viewportScale,
                calculatedPositionsCache
            )
            if (ch.noHope === true) continue
            h = ch.finalPosition as Position
            const marker = ch.marker as Position[]
            let markerCheck = true
            // Check to see if label lies within map bounds
            if (
                h[0] + textWidth > bottomRightBound[0] ||
                h[0] < topLeftBound[0] ||
                h[1] > bottomRightBound[1] ||
                h[1] - fontSize < topLeftBound[1]
            )
                markerCheck = false
            //Collision check between current label and previous labels
            if (markerCheck === true) {
                for (const y of externalLabels) {
                    if (
                        rectIntersection(
                            h,
                            [h[0] + textWidth, h[1]],
                            [h[0] + textWidth, h[1] - fontSize],
                            [h[0], h[1] - fontSize],
                            y
                        )
                    ) {
                        markerCheck = false
                        break
                    }
                }
            }
            //Collision check between previous markers and current marker, label
            if (
                markerCheck === true &&
                markerCollision(markers, marker, h, textWidth, fontSize)
            )
                markerCheck = false
            //Collision check between previous labels and current marker
            if (markerCheck === true)
                for (const y of externalLabels) {
                    if (rectIntersection(y[0], y[1], y[2], y[3], marker)) {
                        markerCheck = false
                        break
                    }
                }
            if (markerCheck === true) {
                const externalLabel = [
                    [h[0], h[1]],
                    [h[0] + textWidth, h[1]],
                    [h[0] + textWidth, h[1] - fontSize],
                    [h[0], h[1] - fontSize],
                ]
                const externalAnnotation = {
                    id: country.id,
                    position: new PointVector(h[0], h[1]),
                    value: value,
                    size: fontSize,
                    type: "external",
                    pole: country.pole,
                    marker: marker,
                    anchor: ch.anchor,
                }
                externalLabels.push(externalLabel)
                markers.push(marker)
                allAnnotations.push(externalAnnotation)
                break
            }
        }
    }
    return allAnnotations
}

function internalGenerator(
    featureData: RenderFeature[],
    choroplethData: Map<string, ChoroplethSeries>,
    viewportScale: number,
    projection: MapProjectionName,
    annotationsCache: Map<MapProjectionName, AnnotationsCache>
): {
    internalAnnotations: Annotation[]
    externalInfo: ExternalInfo[]
} {
    const minSize = MIN_INTERNAL_ANNOTATION_SIZE
    const maxSize = MAX_INTERNAL_ANNOTATION_SIZE
    const externalInfo: ExternalInfo[] = []
    const internalAnnotations: Annotation[] = []
    const regionsCache: Region[] = annotationsCache.get(projection)!.regions
    const internalInfoCache: InternalInfo[] =
        annotationsCache.get(projection)!.internalInfo
    for (const country of featureData) {
        let fontSize = minSize
        const value = choroplethData.get(country.id)!.shortValue!
        let regionPoints: Position[] = []
        let textWidth = pixelWidth(value.toString(), {
            size: fontSize / viewportScale,
            font: "arial",
        })
        const labelPos = internalInfoCache.find(
            (el) => el.id === country.id
        ) as InternalInfo
        const pole = [labelPos.position[0], labelPos.position[1]]
        regionPoints = labelPos.points
        let t1, t2, t3, t4
        let check = false
        while (fontSize < maxSize) {
            textWidth = pixelWidth(value.toString(), {
                size: fontSize / viewportScale,
                font: "arial",
            })
            t1 = [
                pole[0] - textWidth / 2,
                pole[1] + fontSize / viewportScale / 2,
            ]
            t2 = [
                pole[0] - textWidth / 2,
                pole[1] - fontSize / viewportScale / 2,
            ]
            t3 = [
                pole[0] + textWidth / 2,
                pole[1] - fontSize / viewportScale / 2,
            ]
            t4 = [
                pole[0] + textWidth / 2,
                pole[1] + fontSize / viewportScale / 2,
            ]
            if (
                !rectIntersection(t1, t2, t3, t4, regionPoints) &&
                polygonContains(t1, regionPoints)
            ) {
                fontSize++
                check = true
            } else break
        }
        if (check === true) {
            internalAnnotations.push({
                id: country.id,
                position: new PointVector(
                    pole[0] - textWidth / 2,
                    pole[1] + fontSize / viewportScale / 2
                ),
                value: value,
                size: fontSize / viewportScale,
                type: "internal",
                pole: pole,
            })
        } else {
            let externalRegion: Position[]
            if (country.geo.geometry.type == "MultiPolygon")
                for (const x of regionsCache.filter(
                    (x) => x.id == country.id
                )) {
                    if (polygonContains(pole, x.points)) {
                        externalRegion = x.points
                        break
                    }
                }
            else if (country.geo.geometry.type == "Polygon")
                externalRegion = country.geo.geometry.coordinates[0]
            externalInfo.push({
                id: country.id,
                region: externalRegion!,
                area: polygonArea(externalRegion!),
                pole: pole,
                regionPoints: regionPoints,
            })
        }
    }
    return {
        internalAnnotations: internalAnnotations,
        externalInfo: externalInfo,
    }
}

// Replica of polygonContains function in d3-polygon
function polygonContains(point: number[], polygon: Position[]): boolean {
    const x = point[0],
        y = point[1]
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0],
            yi = polygon[i][1]
        const xj = polygon[j][0],
            yj = polygon[j][1]

        const intersect =
            yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
        if (intersect) inside = !inside
    }

    return inside
}

function externalCheck(
    point: number[],
    allPoints: { id: string; points: Position[] }[],
    type: string,
    textWidth: number,
    fontSize: number,
    country: ExternalInfo,
    combinedData: RenderFeature[],
    viewportScale: number,
    calculatedPositionsCache: CalculatedPosition[]
): CalculatedPosition {
    const calculatedPosition = calculatedPositionsCache.find(
        (el) =>
            el.id === country.id &&
            el.textWidth === textWidth &&
            el.labelPosition === type &&
            el.boundaryPosition == point
    )
    if (calculatedPosition !== undefined) return calculatedPosition
    let anchor = false
    const k1 = [point[0], point[1]]
    const kk = true
    if (kk) {
        if (type == ExternalDirections.top) {
            k1[0] = k1[0] - textWidth / 2
        } else if (type == ExternalDirections.bottom) {
            k1[0] = k1[0] - textWidth / 2
            k1[1] = k1[1] + fontSize
        } else if (type == ExternalDirections.left) {
            k1[0] = k1[0] - textWidth
            k1[1] = k1[1] + fontSize / 2
        } else if (type == ExternalDirections.right) {
            k1[1] = k1[1] + fontSize / 2
        } else if (
            type == ExternalDirections.bottomLeft ||
            type == ExternalDirections.topLeft
        ) {
            k1[0] = k1[0] - textWidth
            k1[1] = k1[1] + fontSize / 2
        }
        let u = 1
        let fin = false
        let markerEnd: Position
        if (country.area / viewportScale > 0.5)
            for (let g = 1; g <= 8; g++) externalIncrement(type, k1)
        else anchor = true
        while (u <= 2) {
            let more = true
            externalIncrement(type, k1)
            markerEnd = markerEndPosition(
                type as ExternalDirections,
                k1,
                textWidth,
                fontSize
            )
            for (const x of combinedData) {
                const g1 = [x.bounds.bottomLeft.x, x.bounds.bottomLeft.y]
                const g2 = [x.bounds.bottomRight.x, x.bounds.bottomRight.y]
                const g3 = [x.bounds.topRight.x, x.bounds.topRight.y]
                const g4 = [x.bounds.topLeft.x, x.bounds.topLeft.y]
                const rectPoints = [g1, g2, g3, g4, g1]
                const b1 = k1
                const b2 = [k1[0] + textWidth, k1[1]]
                const b3 = [k1[0] + textWidth, k1[1] - fontSize]
                const b4 = [k1[0], k1[1] - fontSize]
                const firstPoint = x.path
                    .slice(1, x.path.indexOf("L"))
                    .split(",")
                const labelPoints = [b1, b2, b3, b4, b1]
                if (
                    polygonContains(
                        [Number(firstPoint[0]), Number(firstPoint[1])],
                        labelPoints
                    )
                ) {
                    more = false
                    break
                }
                if (
                    rectIntersection(
                        k1,
                        [k1[0] + textWidth, k1[1]],
                        [k1[0] + textWidth, k1[1] - fontSize],
                        [k1[0], k1[1] - fontSize],
                        rectPoints
                    ) ||
                    polygonContains(k1, rectPoints)
                ) {
                    const m = allPoints.filter((el) => el.id === x.id)
                    for (const x2 of m) {
                        if (
                            rectIntersection(
                                k1,
                                [k1[0] + textWidth, k1[1]],
                                [k1[0] + textWidth, k1[1] - fontSize],
                                [k1[0], k1[1] - fontSize],
                                x2.points
                            ) ||
                            polygonContains(k1, x2.points)
                        ) {
                            more = false
                            break
                        }
                    }
                }
                // This should be a intersection check between current marker and all regions
                if (
                    x.id != country.id &&
                    rectIntersection(g1, g2, g3, g4, [point, markerEnd])
                ) {
                    const m = allPoints.filter((el) => el.id === x.id)
                    for (const x2 of m)
                        for (let i = 0; i < x2.points.length - 1; i++) {
                            if (
                                lineIntersection(
                                    point,
                                    markerEnd,
                                    x2.points[i],
                                    x2.points[i + 1]
                                )
                            ) {
                                more = false
                                break
                            }
                        }
                }
            }
            if (more == true) {
                fin = true
                break
            }
            u++
        }
        if (fin == true) {
            const newobj = {
                id: country.id,
                boundaryPosition: point,
                labelPosition: type,
                textWidth: textWidth,
                noHope: false,
                finalPosition: k1,
                anchor: anchor,
                marker: [point, markerEnd!],
            }
            calculatedPositionsCache.push(newobj)
            return newobj
        }
    }
    const newobj = {
        id: country.id,
        boundaryPosition: point,
        labelPosition: type,
        textWidth: textWidth,
        noHope: true,
    }
    calculatedPositionsCache.push(newobj)
    return newobj
}

function getRatio(coordinates: any): number {
    const bounds = geoPath().bounds({ type: "Polygon", coordinates })
    const dx = bounds[1][0] - bounds[0][0]
    const dy = bounds[1][1] - bounds[0][1]
    const ratio = dx / (dy || 1)
    const A = 12
    return Math.min(Math.max(ratio, 1 / A), A)
}

function setAnnotationCache(
    featureData: RenderFeature[],
    projection: MapProjectionName,
    annotationsCache: Map<MapProjectionName, AnnotationsCache>
): void {
    const regions: Region[] = []
    const allPoints: Record<string, number> = {}
    const internalInfo: InternalInfo[] = []
    for (const country of featureData) {
        let pos, ratio
        const geometry = country.geo.geometry
        const path = country.path
        const id = country.id
        let regionPoints: Position[] = []
        if (geometry.type === "Polygon") {
            let maxLength = 0
            const countryPaths = path.slice(1, -1).split("ZM")
            const tempPoints = []
            for (const region of countryPaths) {
                const regionPath = region.split("L")
                const temptemp = []
                for (const temp of regionPath) {
                    const o = [
                        Number(temp.substring(0, temp.indexOf(","))),
                        Number(temp.substring(temp.indexOf(",") + 1)),
                    ]
                    temptemp.push(o)
                    const u = o[0].toString() + "," + o[1].toString()
                    if (u in allPoints) allPoints[u] = allPoints[u] + 1
                    else allPoints[u] = 1
                }
                regions.push({
                    id: country.id,
                    points: temptemp,
                })
                tempPoints.push(temptemp)
                if (tempPoints[tempPoints.length - 1].length > maxLength) {
                    maxLength = tempPoints[tempPoints.length - 1].length
                    regionPoints = tempPoints[tempPoints.length - 1]
                }
            }
            ratio = getRatio(tempPoints)
            pos = polylabelStretched(tempPoints, ratio)
        } else {
            let maxDist = 0
            const countryPaths = path.slice(1, -1).split("ZM")
            for (const region of countryPaths) {
                const tempPoints = []
                const regionPath = region.split("L")
                for (const temp of regionPath) {
                    const o = [
                        Number(temp.substring(0, temp.indexOf(","))),
                        Number(temp.substring(temp.indexOf(",") + 1)),
                    ]
                    tempPoints.push(o)
                    const u = o[0].toString() + "," + o[1].toString()
                    if (u in allPoints) allPoints[u] = allPoints[u] + 1
                    else allPoints[u] = 1
                }
                regions.push({
                    id: country.id,
                    points: tempPoints,
                })
                const r = getRatio([tempPoints])
                const p = polylabelStretched([tempPoints], r)
                if (p.distance > maxDist) {
                    pos = p
                    maxDist = p.distance
                    ratio = r
                    regionPoints = tempPoints
                }
            }
        }
        internalInfo.push({
            position: pos.slice(0, 2),
            points: regionPoints,
            id: id,
        })
    }
    annotationsCache.get(projection)!.regions = regions
    annotationsCache.get(projection)!.internalInfo = internalInfo
    annotationsCache.get(projection)!.allPoints = allPoints
}

function polylabelStretched(rings: Position[][], ratio: number): any {
    const polygon = []
    for (const ring of rings) {
        // stretch the input
        const newRing = []
        for (const [x, y] of ring) newRing.push([x / ratio, y])
        polygon.push(newRing)
    }
    //Type is marked as any because of incorrect type declaration in the polylabel library
    const result: any = polylabel(polygon, 0.5)
    result[0] *= ratio // stretch the result back
    result.distance *= ratio
    return result
}

function rectIntersection(
    p0: Position,
    p1: Position,
    p2: Position,
    p3: Position,
    regionPoints: Position[]
): boolean {
    for (let i = 0; i < regionPoints.length - 1; i++) {
        const v1 = regionPoints[i]
        const v2 = regionPoints[i + 1]
        if (
            lineIntersection(p0, p1, v1, v2) ||
            lineIntersection(p1, p2, v1, v2) ||
            lineIntersection(p2, p3, v1, v2) ||
            lineIntersection(p3, p0, v1, v2)
        )
            return true
    }
    return false
}

function lineIntersection(
    p0: Position,
    p1: Position,
    p2: Position,
    p3: Position
): boolean {
    const s1_x = p1[0] - p0[0]
    const s1_y = p1[1] - p0[1]
    const s2_x = p3[0] - p2[0]
    const s2_y = p3[1] - p2[1]
    const s =
        (-s1_y * (p0[0] - p2[0]) + s1_x * (p0[1] - p2[1])) /
        (-s2_x * s1_y + s1_x * s2_y)
    const t =
        (s2_x * (p0[1] - p2[1]) - s2_y * (p0[0] - p2[0])) /
        (-s2_x * s1_y + s1_x * s2_y)
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
        return true
    }
    return false
}

function markerEndPosition(
    type: ExternalDirections,
    point: Position,
    textWidth: number,
    fontSize: number
): Position {
    switch (type) {
        case ExternalDirections.right:
            return [point[0], point[1] - fontSize / 2.5]
        case ExternalDirections.left:
            return [point[0] + textWidth, point[1] - fontSize / 2.5]
        case ExternalDirections.topRight:
            return point
        case ExternalDirections.bottomRight:
            return [point[0], point[1] - fontSize / 2.5]
        case ExternalDirections.topLeft:
            return [point[0] + textWidth, point[1] - fontSize / 3.5]
        case ExternalDirections.bottomLeft:
            return [point[0] + textWidth, point[1] - fontSize / 2.5]
        case ExternalDirections.bottom:
            return [point[0] + textWidth / 2, point[1] - fontSize]
        case ExternalDirections.top:
            return [point[0] + textWidth / 2, point[1]]
        default:
            return point
    }
}

function externalIncrement(type: string, point: Position): Position {
    const inc1 = 1 / globalScale
    const inc2 = 0.707 / globalScale
    if (type == ExternalDirections.right) point[0] = point[0] + inc1
    else if (type == ExternalDirections.left) point[0] = point[0] - inc1
    else if (type == ExternalDirections.topRight) {
        point[0] = point[0] + inc2
        point[1] = point[1] - inc2
    } else if (type == ExternalDirections.bottomRight) {
        point[0] = point[0] + inc2
        point[1] = point[1] + inc2
    } else if (type == ExternalDirections.topLeft) {
        point[0] = point[0] - inc2
        point[1] = point[1] - inc2
    } else if (type == ExternalDirections.bottomLeft) {
        point[0] = point[0] - inc2
        point[1] = point[1] + inc2
    } else if (type == ExternalDirections.bottom) {
        point[1] = point[1] + inc1
    } else if (type == ExternalDirections.top) {
        point[1] = point[1] - inc1
    }
    return point
}

// Replica of polygonArea function in d3-polygon except it returns unsigned area
function polygonArea(polygon: Position[]): number {
    const n = polygon.length
    let i = -1,
        a,
        b = polygon[n - 1],
        area = 0

    while (++i < n) {
        a = b
        b = polygon[i]
        area += a[1] * b[0] - a[0] * b[1]
    }
    //Returning unsigned area
    return Math.abs(area / 2)
}

function markerCollision(
    markers: Position[][],
    marker: Position[],
    h: Position,
    textWidth: number,
    fontSize: number
): boolean {
    for (const y of markers) {
        if (
            lineIntersection(y[0], y[1], marker[0], marker[1]) ||
            lineIntersection(y[0], y[1], h, [h[0] + textWidth, h[1]]) ||
            lineIntersection(
                y[0],
                y[1],
                [h[0] + textWidth, h[1]],
                [h[0] + textWidth, h[1] - fontSize]
            ) ||
            lineIntersection(
                y[0],
                y[1],
                [h[0] + textWidth, h[1] - fontSize],
                [h[0], h[1] - fontSize]
            ) ||
            lineIntersection(y[0], y[1], [h[0], h[1] - fontSize], h)
        ) {
            return true
        }
    }
    return false
}

function getCoastPositions(
    country: ExternalInfo,
    projection: MapProjectionName,
    annotationsCache: Map<MapProjectionName, AnnotationsCache>
): void {
    const id = country.id
    const pole = country.pole
    const regionPoints = country.regionPoints
    const ans: { [position: string]: Position } = {}
    const degChecks: { [position: string]: number } = {}
    const allPoints = annotationsCache.get(projection)!.allPoints
    for (const x of regionPoints) {
        if (allPoints[x.join()] > 1) continue
        const deg =
            (Math.atan((x[1] - pole[1]) / (x[0] - pole[0])) * 180) / Math.PI
        if (deg >= 0) {
            if (x[0] > pole[0]) {
                if (!(ExternalDirections.right in degChecks)) {
                    degChecks[ExternalDirections.right] = deg
                    ans[ExternalDirections.right] = x
                } else {
                    if (degChecks[ExternalDirections.right] > deg) {
                        degChecks[ExternalDirections.right] = deg
                        ans[ExternalDirections.right] = x
                    }
                }
                if (!(ExternalDirections.topRight in degChecks)) {
                    degChecks[ExternalDirections.right] = deg
                    ans[ExternalDirections.topRight] = x
                } else {
                    if (
                        Math.abs(45 - degChecks[ExternalDirections.topRight]) >
                        Math.abs(deg - 45)
                    ) {
                        degChecks[ExternalDirections.topRight] = deg
                        ans[ExternalDirections.topRight] = x
                    }
                }
                if (!(ExternalDirections.top in degChecks)) {
                    degChecks[ExternalDirections.top] = deg
                    ans[ExternalDirections.top] = x
                } else {
                    if (degChecks[ExternalDirections.top] - deg < 0) {
                        degChecks[ExternalDirections.top] = deg
                        ans[ExternalDirections.top] = x
                    }
                }
            } else {
                if (!(ExternalDirections.left in degChecks)) {
                    degChecks[ExternalDirections.left] = deg
                    ans[ExternalDirections.left] = x
                } else {
                    if (degChecks[ExternalDirections.left] > deg) {
                        degChecks[ExternalDirections.left] = deg
                        ans[ExternalDirections.left] = x
                    }
                }
                if (!(ExternalDirections.bottomRight in degChecks)) {
                    degChecks[ExternalDirections.bottomRight] = deg
                    ans[ExternalDirections.bottomRight] = x
                } else {
                    if (
                        Math.abs(
                            45 - degChecks[ExternalDirections.bottomRight]
                        ) > Math.abs(deg - 45)
                    ) {
                        degChecks[ExternalDirections.bottomRight] = deg
                        ans[ExternalDirections.bottomRight] = x
                    }
                }
                if (!(ExternalDirections.bottom in degChecks)) {
                    degChecks[ExternalDirections.bottom] = deg
                    ans[ExternalDirections.bottom] = x
                } else {
                    if (degChecks[ExternalDirections.bottom] - deg < 0) {
                        degChecks[ExternalDirections.bottom] = deg
                        ans[ExternalDirections.bottom] = x
                    }
                }
            }
        }
    }
    annotationsCache
        .get(projection)!
        .coastPositions.push({ id: id, positions: ans })
}
