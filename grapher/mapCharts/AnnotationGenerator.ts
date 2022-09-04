import { PointVector } from "../../clientUtils/PointVector.js"
import pixelWidth from "string-pixel-width"
import {
    ChoroplethSeries,
    internalLabel,
    RenderFeature,
} from "./MapChartConstants.js"
import { MapProjectionName } from "./MapProjections.js"
import { geoPath } from "d3-geo"
import polylabel from "polylabel"
import { Position } from "geojson"
import { Bounds } from "../../clientUtils/Bounds.js"

enum externalPositions {
    right = "right",
    left = "left",
    topRight = "topRight",
    bottomRight = "bottomRight",
    topLeft = "topLeft",
    bottomLeft = "bottomLeft",
    bottom = "bottom",
    top = "top",
}

interface Itemp {
    id: string
    region: Position[]
    area: number
    pole: Position
    regionPoints: Position[]
}

interface Iinternal {
    position: number[]
    points: Position[]
    id: string
}

interface Icoast {
    positions: { [position: string]: Position }
    id: string
}

interface IcombinedRegions {
    id: string
    points: Position[]
}

let prevExternal: {
    externalLabels: Position[]
    markers: Position[]
    finale: internalLabel
    id: string
    textWidth: number
}[]
let globalScale: number

export function generateAnnotations(
    featureData: RenderFeature[],
    featuresWithNoData: RenderFeature[],
    choroplethData: Map<string, ChoroplethSeries>,
    viewportScale: number,
    offset: number[],
    bounds: Bounds,
    projection: MapProjectionName,
    annotationsCache: Map<string, any>
): internalLabel[] {
    if (!annotationsCache.has(projection)) {
        annotationsCache.set(projection, new Map<string, any>())
        combinedRegions(
            [...featureData, ...featuresWithNoData],
            projection,
            annotationsCache
        )
        getLabelInfo(featureData, projection, annotationsCache)
        annotationsCache.get(projection).set("coastPositions", [])
        prevExternal = []
    }
    globalScale = viewportScale
    /* if (
        prevProjection === projection &&
        prevOffset === offset &&
        prevBounds === bounds &&
        prevViewportScale === viewportScale
    )
    annotationsCache.set("noChanges",true) */
    const combinedRegionsCache: IcombinedRegions[] = annotationsCache
        .get(projection)
        .get("combinedRegions")
    const coastPositionsCache: Icoast[] = annotationsCache
        .get(projection)
        .get("coastPositions")
    const topLeftBoundPoint = [
        (bounds.x - offset[0]) / viewportScale,
        (bounds.y - offset[1]) / viewportScale,
    ]
    const bottomRightBoundPoint = [
        (bounds.x - offset[0] + bounds.width) / viewportScale,
        (bounds.y - offset[1] + bounds.height) / viewportScale,
    ]
    const externalLabels: Position[][] = []
    const markers: Position[][] = []
    const confused = internalGenerator(
        featureData,
        choroplethData,
        viewportScale,
        projection,
        annotationsCache
    )
    const finale: internalLabel[] = confused.labels
    confused.externalAreas.sort((a, b) => b.area - a.area)
    for (const country of confused.externalAreas) {
        const fontSize = 11 / viewportScale
        const value = choroplethData.get(country.id)?.shortValue
        let textWidth
        let h = null
        if (value)
            textWidth = pixelWidth(value.toString(), {
                size: fontSize,
                font: "arial",
            })
        if (textWidth) {
            if (
                annotationsCache.get("noChanges") &&
                prevExternal.find((el) => el.id === country.id)?.textWidth ===
                    textWidth
            ) {
                const singular = prevExternal.find((el) => el.id === country.id)
                if (singular) {
                    externalLabels.push(singular.externalLabels)
                    markers.push(singular.markers)
                    finale.push(singular.finale)
                }
            } else {
                if (
                    coastPositionsCache.find((el) => el.id === country.id) ===
                    undefined
                )
                    getCoastPositions(
                        country.id,
                        country.pole,
                        country.regionPoints,
                        projection,
                        annotationsCache
                    )
                const coastPositions = coastPositionsCache.find(
                    (el) => el.id === country.id
                ) as Icoast
                for (const pos in coastPositions.positions) {
                    h = externalCheck(
                        coastPositions.positions[pos],
                        combinedRegionsCache,
                        pos,
                        textWidth,
                        fontSize,
                        externalLabels
                    )
                    if (h.length == 2) {
                        const markerStart = coastPositions.positions[pos]
                        const markerEnding = markerEndPosition(
                            pos as externalPositions,
                            h,
                            textWidth,
                            fontSize
                        )
                        let markerCheck = true
                        // Check to see if label lies within map bounds
                        if (
                            h[0] + textWidth > bottomRightBoundPoint[0] ||
                            h[0] < topLeftBoundPoint[0] ||
                            h[1] > bottomRightBoundPoint[1] ||
                            h[1] - fontSize < topLeftBoundPoint[1]
                        )
                            markerCheck = false
                        if (markerCheck)
                            for (const y of markers) {
                                if (
                                    lineIntersection(
                                        y[0],
                                        y[1],
                                        markerStart,
                                        markerEnding
                                    ) ||
                                    lineIntersection(y[0], y[1], h, [
                                        h[0] + textWidth,
                                        h[1],
                                    ]) ||
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
                                    lineIntersection(
                                        y[0],
                                        y[1],
                                        [h[0], h[1] - fontSize],
                                        h
                                    )
                                ) {
                                    // TODO: shouldn't i breaking for correct case instead?
                                    markerCheck = false
                                    break
                                }
                            }
                        if (markerCheck === true)
                            for (const y of externalLabels) {
                                if (
                                    lineIntersection(
                                        y[0],
                                        y[1],
                                        markerStart,
                                        markerEnding
                                    ) ||
                                    lineIntersection(
                                        y[1],
                                        y[2],
                                        markerStart,
                                        markerEnding
                                    ) ||
                                    lineIntersection(
                                        y[2],
                                        y[3],
                                        markerStart,
                                        markerEnding
                                    ) ||
                                    lineIntersection(
                                        y[3],
                                        y[0],
                                        markerStart,
                                        markerEnding
                                    )
                                ) {
                                    markerCheck = false
                                    break
                                }
                            }
                        if (markerCheck === true) {
                            const r1 = [
                                [h[0], h[1]],
                                [h[0] + textWidth, h[1]],
                                [h[0] + textWidth, h[1] - fontSize],
                                [h[0], h[1] - fontSize],
                            ]
                            const r2 = [markerStart, markerEnding]
                            const r3 = {
                                id: country.id,
                                position: new PointVector(h[0], h[1]),
                                value: value,
                                size: fontSize,
                                type: "external",
                                pole: country.pole,
                                markerStart: markerStart,
                                markerEnd: markerEnding,
                            }
                            externalLabels.push(r1)
                            markers.push(r2)
                            finale.push(r3)
                            prevExternal.push({
                                externalLabels: r1,
                                markers: r2,
                                finale: r3,
                                id: country.id,
                                textWidth: textWidth,
                            })
                            break
                        }
                    }
                }
            }
        }
    }
    return finale
}

function internalGenerator(
    featureData: RenderFeature[],
    choroplethData: Map<string, ChoroplethSeries>,
    viewportScale: number,
    projection: MapProjectionName,
    annotationsCache: Map<string, any>
): {
    labels: internalLabel[]
    externalAreas: Itemp[]
} {
    const minSize = 8
    const maxSize = 14
    const outerinfo: Itemp[] = []
    const combinedRegionsCache: IcombinedRegions[] = annotationsCache
        .get(projection)
        .get("combinedRegions")
    const retVal: internalLabel[] = []
    const polylabelCache: Iinternal[] = annotationsCache
        .get(projection)
        .get("polylabels")
    for (const country of featureData) {
        let fontSize = minSize
        const value = choroplethData.get(country.id)?.shortValue
        let textWidth
        let regionPoints: Position[] = []
        if (value) {
            textWidth = pixelWidth(value.toString(), {
                size: fontSize / viewportScale,
                font: "arial",
            })
        }
        const labelPos = polylabelCache.find(
            (el) => el.id === country.id
        ) as Iinternal
        const p1 = labelPos.position[0]
        const p2 = labelPos.position[1]
        const centerpoint = new PointVector(p1, p2)
        const pole = [p1, p2]
        regionPoints = labelPos.points
        if (p1 && p2 && textWidth) {
            const t1 = [
                centerpoint.x - textWidth / 2,
                centerpoint.y + fontSize / viewportScale / 2,
            ]
            const t2 = [
                centerpoint.x - textWidth / 2,
                centerpoint.y - fontSize / viewportScale / 2,
            ]
            const t3 = [
                centerpoint.x + textWidth / 2,
                centerpoint.y - fontSize / viewportScale / 2,
            ]
            const t4 = [
                centerpoint.x + textWidth / 2,
                centerpoint.y + fontSize / viewportScale / 2,
            ]
            if (
                !rectIntersection(t1, t2, t3, t4, regionPoints) &&
                insideCheck(t1, regionPoints)
            ) {
                while (fontSize < maxSize) {
                    if (value) {
                        textWidth = pixelWidth(value.toString(), {
                            size: (fontSize + 1) / viewportScale,
                            font: "arial",
                        })
                    }
                    const n1 = [
                        centerpoint.x - textWidth / 2,
                        centerpoint.y + (fontSize + 1) / viewportScale / 2,
                    ]
                    const n2 = [
                        centerpoint.x - textWidth / 2,
                        centerpoint.y - (fontSize + 1) / viewportScale / 2,
                    ]
                    const n3 = [
                        centerpoint.x + textWidth / 2,
                        centerpoint.y - (fontSize + 1) / viewportScale / 2,
                    ]
                    const n4 = [
                        centerpoint.x + textWidth / 2,
                        centerpoint.y + (fontSize + 1) / viewportScale / 2,
                    ]
                    if (
                        !rectIntersection(n1, n2, n3, n4, regionPoints) &&
                        insideCheck(t1, regionPoints)
                    )
                        fontSize++
                    else break
                }
                retVal.push({
                    id: country.id,
                    position: new PointVector(
                        p1 - textWidth / 2,
                        p2 + fontSize / viewportScale / 2
                    ),
                    value: value,
                    size: fontSize / viewportScale,
                    type: "internal",
                    pole: pole,
                })
            } else {
                if (country.geo.geometry.type == "MultiPolygon")
                    for (const x of combinedRegionsCache.filter(
                        (x) => x.id == country.id
                    )) {
                        if (insideCheck([p1, p2], x.points)) {
                            outerinfo.push({
                                id: country.id,
                                region: x.points,
                                area: polygonArea2(x.points),
                                pole: pole,
                                regionPoints: regionPoints,
                            })
                            break
                        }
                    }
                else if (country.geo.geometry.type == "Polygon")
                    outerinfo.push({
                        id: country.id,
                        region: country.geo.geometry.coordinates[0],
                        area: polygonArea2(country.geo.geometry.coordinates[0]),
                        pole: pole,
                        regionPoints: regionPoints,
                    })
            }
        }
        // End of internal annotations
    }
    return {
        labels: retVal,
        externalAreas: outerinfo,
    }
}

function insideCheck(point: number[], vs: Position[]): boolean {
    const x = point[0],
        y = point[1]
    let inside = false
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i][0],
            yi = vs[i][1]
        const xj = vs[j][0],
            yj = vs[j][1]

        const intersect =
            yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
        if (intersect) inside = !inside
    }

    return inside
}

function combinedRegions(
    data: RenderFeature[],
    projection: MapProjectionName,
    annotationsCache: Map<string, any>
): void {
    const allPoints: { id: string; points: Position[] }[] = []
    data.map(function (country) {
        const countryPaths = country.path.slice(1, -1).split("ZM")
        for (const region of countryPaths) {
            const regionPath = region.split("L")
            allPoints.push({
                id: country.id,
                points: regionPath.map((temp) => [
                    Number(temp.substring(0, temp.indexOf(","))),
                    Number(temp.substring(temp.indexOf(",") + 1)),
                ]),
            })
        }
    })
    annotationsCache.get(projection).set("combinedRegions", allPoints)
}

function externalCheck(
    point: number[],
    allPoints: { id: string; points: Position[] }[],
    type: string,
    textWidth: number,
    fontSize: number,
    externalLabels: Position[][]
): number[] {
    const k1 = [point[0], point[1]]
    const kk = true
    if (kk) {
        if (type == externalPositions.top) {
            k1[0] = k1[0] - textWidth / 2
        } else if (type == externalPositions.bottom) {
            k1[0] = k1[0] - textWidth / 2
            k1[1] = k1[1] + fontSize
        } else if (type == externalPositions.left) {
            k1[0] = k1[0] - textWidth
            k1[1] = k1[1] + fontSize / 2
        } else if (type == externalPositions.right) {
            k1[1] = k1[1] + fontSize / 2
        } else if (
            type == externalPositions.bottomLeft ||
            type == externalPositions.topLeft
        ) {
            k1[0] = k1[0] - textWidth
            k1[1] = k1[1] + fontSize / 2
        }
        let u = 1
        let fin = false
        for (let g = 1; g <= 8; g++) externalIncrement(type, k1)
        while (u <= 8) {
            let more = true
            externalIncrement(type, k1)
            for (const x of allPoints) {
                if (
                    rectIntersection(
                        k1,
                        [k1[0] + textWidth, k1[1]],
                        [k1[0] + textWidth, k1[1] - fontSize],
                        [k1[0], k1[1] - fontSize],
                        x.points
                    ) ||
                    insideCheck(k1, x.points)
                ) {
                    more = false
                    break
                }
            }
            if (more == true) {
                fin = true
                break
            }
            u++
        }
        if (fin == true) {
            for (const y of externalLabels) {
                if (
                    rectIntersection(
                        k1,
                        [k1[0] + textWidth, k1[1]],
                        [k1[0] + textWidth, k1[1] - fontSize],
                        [k1[0], k1[1] - fontSize],
                        y
                    )
                ) {
                    fin = false
                    break
                }
            }
        }
        if (fin == true) return [k1[0], k1[1]]
    }

    return []
}

function getRatio(coordinates: any): number {
    const bounds = geoPath().bounds({ type: "Polygon", coordinates })
    const dx = bounds[1][0] - bounds[0][0]
    const dy = bounds[1][1] - bounds[0][1]
    const ratio = dx / (dy || 1)
    const A = 12
    return Math.min(Math.max(ratio, 1 / A), A)
}

function getLabelInfo(
    featureData: RenderFeature[],
    projection: MapProjectionName,
    annotationsCache: Map<string, any>
): void {
    const allPoints: Record<string, number> = {}
    const polylabelCache: Iinternal[] = []
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
        polylabelCache.push({
            position: pos.slice(0, 2),
            points: regionPoints,
            id: id,
        })
    }
    annotationsCache.get(projection).set("polylabels", polylabelCache)
    annotationsCache.get(projection).set("allPoints", allPoints)
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
    type: externalPositions,
    point: Position,
    textWidth: number,
    fontSize: number
): Position {
    switch (type) {
        case externalPositions.right:
            return [point[0], point[1] - fontSize / 2.5]
        case externalPositions.left:
            return [point[0] + textWidth, point[1] - fontSize / 2.5]
        case externalPositions.topRight:
            return point
        case externalPositions.bottomRight:
            return [point[0], point[1] - fontSize / 2.5]
        case externalPositions.topLeft:
            return [point[0] + textWidth, point[1] - fontSize / 3.5]
        case externalPositions.bottomLeft:
            return [point[0] + textWidth, point[1] - fontSize / 2.5]
        case externalPositions.bottom:
            return [point[0] + textWidth / 2, point[1] - fontSize]
        case externalPositions.top:
            return [point[0] + textWidth / 2, point[1]]
        default:
            return point
    }
}

function externalIncrement(type: string, point: Position): Position {
    const inc1 = 1 / globalScale
    const inc2 = 0.707 / globalScale
    if (type == externalPositions.right) point[0] = point[0] + inc1
    else if (type == externalPositions.left) point[0] = point[0] - inc1
    else if (type == externalPositions.topRight) {
        point[0] = point[0] + inc2
        point[1] = point[1] - inc2
    } else if (type == externalPositions.bottomRight) {
        point[0] = point[0] + inc2
        point[1] = point[1] + inc2
    } else if (type == externalPositions.topLeft) {
        point[0] = point[0] - inc2
        point[1] = point[1] - inc2
    } else if (type == externalPositions.bottomLeft) {
        point[0] = point[0] - inc2
        point[1] = point[1] + inc2
    } else if (type == externalPositions.bottom) {
        point[1] = point[1] + inc1
    } else if (type == externalPositions.top) {
        point[1] = point[1] - inc1
    }
    return point
}

// Replica of polygonArea function in d3-polygon
function polygonArea2(polygon: Position[]): number {
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

function getCoastPositions(
    id: string,
    point: Position,
    regionPoints: Position[],
    projection: MapProjectionName,
    annotationsCache: Map<string, any>
): void {
    const ans: { [position: string]: Position } = {}
    const degChecks: { [position: string]: number } = {}
    const allPoints = annotationsCache.get(projection).get("allPoints")
    for (const x of regionPoints) {
        if (allPoints[x.join()] > 1) continue
        const deg =
            (Math.atan((x[1] - point[1]) / (x[0] - point[0])) * 180) / Math.PI
        if (deg >= 0) {
            if (x[0] > point[0]) {
                if (!(externalPositions.right in degChecks)) {
                    degChecks[externalPositions.right] = deg
                    ans[externalPositions.right] = x
                } else {
                    if (degChecks[externalPositions.right] > deg) {
                        degChecks[externalPositions.right] = deg
                        ans[externalPositions.right] = x
                    }
                }
                if (!(externalPositions.topRight in degChecks)) {
                    degChecks[externalPositions.right] = deg
                    ans[externalPositions.topRight] = x
                } else {
                    if (
                        Math.abs(45 - degChecks[externalPositions.topRight]) >
                        Math.abs(deg - 45)
                    ) {
                        degChecks[externalPositions.topRight] = deg
                        ans[externalPositions.topRight] = x
                    }
                }
                if (!(externalPositions.top in degChecks)) {
                    degChecks[externalPositions.top] = deg
                    ans[externalPositions.top] = x
                } else {
                    if (degChecks[externalPositions.top] - deg < 0) {
                        degChecks[externalPositions.top] = deg
                        ans[externalPositions.top] = x
                    }
                }
            } else {
                if (!(externalPositions.left in degChecks)) {
                    degChecks[externalPositions.left] = deg
                    ans[externalPositions.left] = x
                } else {
                    if (degChecks[externalPositions.left] > deg) {
                        degChecks[externalPositions.left] = deg
                        ans[externalPositions.left] = x
                    }
                }
                if (!(externalPositions.bottomRight in degChecks)) {
                    degChecks[externalPositions.bottomRight] = deg
                    ans[externalPositions.bottomRight] = x
                } else {
                    if (
                        Math.abs(
                            45 - degChecks[externalPositions.bottomRight]
                        ) > Math.abs(deg - 45)
                    ) {
                        degChecks[externalPositions.bottomRight] = deg
                        ans[externalPositions.bottomRight] = x
                    }
                }
                if (!(externalPositions.bottom in degChecks)) {
                    degChecks[externalPositions.bottom] = deg
                    ans[externalPositions.bottom] = x
                } else {
                    if (degChecks[externalPositions.bottom] - deg < 0) {
                        degChecks[externalPositions.bottom] = deg
                        ans[externalPositions.bottom] = x
                    }
                }
            }
        }
    }
    annotationsCache
        .get(projection)
        .get("coastPositions")
        .push({ id: id, positions: ans })
}
