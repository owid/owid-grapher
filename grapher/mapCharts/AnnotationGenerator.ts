import { PointVector } from "../../clientUtils/PointVector.js"
import pixelWidth from "string-pixel-width"
import {
    ChoroplethSeries,
    GeoFeature,
    internalLabel,
    RenderFeature,
} from "./MapChartConstants.js"
import { MapProjectionName, MapProjectionGeos } from "./MapProjections.js"
import { geoPath } from "d3-geo"
import polylabel from "polylabel"
import { Position } from "geojson"
import { WorldRegionToProjection } from "./WorldRegionsToProjection.js"
import { polygonArea } from "d3-polygon"
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
}

export function generateAnnotations(
    featureData: RenderFeature[],
    featuresWithNoData: RenderFeature[],
    choroplethData: Map<string, ChoroplethSeries>,
    viewportScale: number,
    offset: number[],
    bounds: Bounds,
    projection: MapProjectionName
): internalLabel[] {
    const just = combinedRegions([...featureData, ...featuresWithNoData])
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
        featuresWithNoData,
        choroplethData,
        viewportScale,
        projection
    )
    let finale: internalLabel[] = confused.labels
    confused.externalAreas.sort((a, b) => b.area - a.area)
    for (const country of confused.externalAreas) {
        let fontSize = 11 / viewportScale
        let value = choroplethData.get(country.id)?.shortValue
        let textWidth
        let h = null
        if (value)
            textWidth = pixelWidth(value.toString(), {
                size: fontSize,
                font: "arial",
            })
        if (textWidth) {
            for (const pos of Object.values(externalPositions)) {
                h = externalCheck(
                    [country.pole[0], country.pole[1]],
                    just,
                    pos,
                    textWidth,
                    fontSize,
                    externalLabels,
                    country.id
                )
                if (h.length == 2) {
                    let markerEnding = markerEndPosition(
                        pos,
                        h,
                        textWidth,
                        fontSize
                    )
                    let markerCheck = true
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
                                    [country.pole[0], country.pole[1]],
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
                                    [country.pole[0], country.pole[1]],
                                    markerEnding
                                ) ||
                                lineIntersection(
                                    y[1],
                                    y[2],
                                    [country.pole[0], country.pole[1]],
                                    markerEnding
                                ) ||
                                lineIntersection(
                                    y[2],
                                    y[3],
                                    [country.pole[0], country.pole[1]],
                                    markerEnding
                                ) ||
                                lineIntersection(
                                    y[3],
                                    y[0],
                                    [country.pole[0], country.pole[1]],
                                    markerEnding
                                )
                            ) {
                                markerCheck = false
                                break
                            }
                        }
                    if (markerCheck === true) {
                        externalLabels.push([
                            [h[0], h[1]],
                            [h[0] + textWidth, h[1]],
                            [h[0] + textWidth, h[1] - fontSize],
                            [h[0], h[1] - fontSize],
                        ])
                        markers.push([
                            [country.pole[0], country.pole[1]],
                            markerEnding,
                        ])
                        finale.push({
                            id: country.id,
                            position: new PointVector(h[0], h[1]),
                            value: value,
                            size: fontSize,
                            type: "external",
                            pole: [country.pole[0], country.pole[1]],
                            markerEnd: markerEnding,
                        })
                    }
                }
            }
        }
    }
    return finale
}

function internalGenerator(
    featureData: RenderFeature[],
    featuresWithNoData: RenderFeature[],
    choroplethData: Map<string, ChoroplethSeries>,
    viewportScale: number,
    projection: MapProjectionName
): {
    labels: internalLabel[]
    externalAreas: Itemp[]
} {
    const minSize = 8
    const maxSize = 14
    const projectionGeo = MapProjectionGeos[projection]
    let outerinfo: Itemp[] = []
    const just = combinedRegions([...featureData, ...featuresWithNoData])
    const retVal: internalLabel[] = []
    for (const country of featureData) {
        let fontSize = minSize
        let value = choroplethData.get(country.id)?.shortValue
        let textWidth
        let regionPoints: Position[] = []
        if (value) {
            textWidth = pixelWidth(value.toString(), {
                size: fontSize / viewportScale,
                font: "arial",
            })
        }
        const labelPos = getLabelInfo(country.geo.geometry)
        const projectionPath = projectionGeo({
            type: "Point",
            coordinates: [labelPos[0], labelPos[1]],
        })
        const p1 = Number(
            projectionPath?.substring(1, projectionPath.indexOf(","))
        )
        const p2 = Number(
            projectionPath?.substring(
                projectionPath.indexOf(",") + 1,
                projectionPath.indexOf(",", projectionPath.indexOf(",") + 1) - 2
            )
        )
        const centerpoint = new PointVector(p1, p2)
        const pole = [p1, p2]
        if (country.geo.geometry.type === "Polygon") {
            let regionPath = country.path.slice(1, -1).split("L")
            regionPoints = regionPath.map((temp) => [
                Number(temp.substring(0, temp.indexOf(","))),
                Number(temp.substring(temp.indexOf(",") + 1)),
            ])
        } else {
            let countryPaths = country.path.slice(1, -1).split("ZM")
            for (const region of countryPaths) {
                regionPoints = []
                let regionPath = region.split("L")
                regionPoints = regionPath.map((temp) => [
                    Number(temp.substring(0, temp.indexOf(","))),
                    Number(temp.substring(temp.indexOf(",") + 1)),
                ])
                if (insideCheck([p1, p2], regionPoints)) break
            }
        }
        if (p1 && p2 && textWidth) {
            let t1 = [
                centerpoint.x - textWidth / 2,
                centerpoint.y + fontSize / viewportScale / 2,
            ]
            let t2 = [
                centerpoint.x - textWidth / 2,
                centerpoint.y - fontSize / viewportScale / 2,
            ]
            let t3 = [
                centerpoint.x + textWidth / 2,
                centerpoint.y - fontSize / viewportScale / 2,
            ]
            let t4 = [
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
                    let n1 = [
                        centerpoint.x - textWidth / 2,
                        centerpoint.y + (fontSize + 1) / viewportScale / 2,
                    ]
                    let n2 = [
                        centerpoint.x - textWidth / 2,
                        centerpoint.y - (fontSize + 1) / viewportScale / 2,
                    ]
                    let n3 = [
                        centerpoint.x + textWidth / 2,
                        centerpoint.y - (fontSize + 1) / viewportScale / 2,
                    ]
                    let n4 = [
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
                    for (const x of just.filter((x) => x.id == country.id)) {
                        if (insideCheck([p1, p2], x.points)) {
                            outerinfo.push({
                                id: country.id,
                                region: x.points,
                                area: polygonArea2(x.points),
                                pole: pole,
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
    var x = point[0],
        y = point[1]
    var inside = false
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i][0],
            yi = vs[i][1]
        var xj = vs[j][0],
            yj = vs[j][1]

        var intersect =
            yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
        if (intersect) inside = !inside
    }

    return inside
}

function combinedRegions(
    data: RenderFeature[]
): { id: string; points: Position[] }[] {
    let allPoints: { id: string; points: Position[] }[] = []
    data.map(function (country) {
        if (country.geo.geometry.type === "Polygon") {
            let regionPath = country.path.slice(1, -1).split("L")
            allPoints.push({
                id: country.id,
                points: regionPath.map((temp) => [
                    Number(temp.substring(0, temp.indexOf(","))),
                    Number(temp.substring(temp.indexOf(",") + 1)),
                ]),
            })
        } else {
            let countryPaths = country.path.slice(1, -1).split("ZM")
            for (const region of countryPaths) {
                let regionPath = region.split("L")
                allPoints.push({
                    id: country.id,
                    points: regionPath.map((temp) => [
                        Number(temp.substring(0, temp.indexOf(","))),
                        Number(temp.substring(temp.indexOf(",") + 1)),
                    ]),
                })
            }
        }
    })
    return allPoints
}

function externalCheck(
    point: number[],
    allPoints: { id: string; points: Position[] }[],
    type: externalPositions,
    textWidth: number,
    fontSize: number,
    externalLabels: Position[][],
    id: string
): number[] {
    let k1 = [point[0], point[1]]
    let i = 0
    let g1 = false
    let g2 = true
    let shoulder: Position[] = []
    while (true) {
        let tt = true
        if (i > 25) break
        if (i == 0) {
            for (const x of allPoints) {
                if (insideCheck(k1, x.points)) {
                    shoulder = x.points
                    if (x.id != id) g2 = false
                    break
                }
            }
        } else if (!insideCheck(k1, shoulder)) {
            for (const x of allPoints) {
                if (insideCheck(k1, x.points)) {
                    tt = false
                    break
                }
            }
            if (tt == true) {
                g1 = true
                break
            } else {
                break
            }
        }
        if (g2 == false) break
        k1 = externalIncrement(type, k1)
        i++
    }
    if (g1 == true) {
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

function getLabelInfo(geometry: GeoFeature["geometry"]): number[] {
    let pos, ratio
    if (geometry.type === "MultiPolygon") {
        let maxDist = 0 // for multipolygons, pick the polygon with most available space
        for (const polygon of geometry.coordinates) {
            const r = getRatio(polygon)
            const p = polylabelStretched(polygon, r)
            if (p.distance > maxDist) {
                pos = p
                maxDist = p.distance
                ratio = r
            }
        }
    } else if (geometry.type === "Polygon") {
        ratio = getRatio(geometry.coordinates)
        pos = polylabelStretched(geometry.coordinates, ratio)
    }
    return pos.slice(0, 2)
}

function polylabelStretched(rings: Position[][], ratio: number) {
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
    for (var i = 0; i < regionPoints.length - 1; i++) {
        let v1 = regionPoints[i]
        let v2 = regionPoints[i + 1]
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
    var s, s1_x, s1_y, s2_x, s2_y, t

    s1_x = p1[0] - p0[0]
    s1_y = p1[1] - p0[1]
    s2_x = p3[0] - p2[0]
    s2_y = p3[1] - p2[1]
    s =
        (-s1_y * (p0[0] - p2[0]) + s1_x * (p0[1] - p2[1])) /
        (-s2_x * s1_y + s1_x * s2_y)
    t =
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

function externalIncrement(type: externalPositions, point: Position): Position {
    if (type == externalPositions.right) point[0] = point[0] + 1
    else if (type == externalPositions.left) point[0] = point[0] - 1
    else if (type == externalPositions.topRight) {
        point[0] = point[0] + 0.707
        point[1] = point[1] - 0.707
    } else if (type == externalPositions.bottomRight) {
        point[0] = point[0] + 0.707
        point[1] = point[1] + 0.707
    } else if (type == externalPositions.topLeft) {
        point[0] = point[0] - 0.707
        point[1] = point[1] - 0.707
    } else if (type == externalPositions.bottomLeft) {
        point[0] = point[0] - 0.707
        point[1] = point[1] + 0.707
    } else if (type == externalPositions.bottom) {
        point[1] = point[1] + 1
    } else if (type == externalPositions.top) {
        point[1] = point[1] - 1
    }
    return point
}

// Replica of polygonArea function in d3-polygon
function polygonArea2(polygon: Position[]) {
    var i = -1,
        n = polygon.length,
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
