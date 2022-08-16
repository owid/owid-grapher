import { PointVector } from "../../clientUtils/PointVector.js"
import pixelWidth from "string-pixel-width"
import {
    ChoroplethSeries,
    GeoFeature,
    RenderFeature,
} from "./MapChartConstants.js"
import { MapProjectionName, MapProjectionGeos } from "./MapProjections.js"
import { geoPath } from "d3-geo"
import polylabel from "polylabel"
import { Position } from "geojson"
import { WorldRegionToProjection } from "./WorldRegionsToProjection.js"

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

interface internalLabel {
    id: string
    position: PointVector
    value?: any
    size: number
    type: string
    pole: Position
    markerEnd?: Position
}

export function generateAnnotations(
    featureData: RenderFeature[],
    featuresWithNoData: RenderFeature[],
    choroplethData: Map<string, ChoroplethSeries>,
    viewportScale: number,
    projection: MapProjectionName
): internalLabel[] {
    const minSize = 8
    const maxSize = 16
    const projectionGeo = MapProjectionGeos[projection]
    const just = yessir([...featureData, ...featuresWithNoData])
    let nextIter: RenderFeature[] = []
    const externalLabels: Position[][] = []
    var retVal = featureData.map(function (country) {
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
                return {
                    id: country.id,
                    position: new PointVector(
                        p1 - textWidth / 2,
                        p2 + fontSize / viewportScale / 2
                    ),
                    value: value,
                    size: fontSize / viewportScale,
                    type: "internal",
                    pole: pole,
                }
            }
        }
        nextIter.push(country)
        let h = null
        if (value)
            textWidth = pixelWidth(value.toString(), {
                size: 11 / viewportScale,
                font: "arial",
            })
        if (textWidth) {
            for (const pos of Object.values(externalPositions)) {
                h = externalCheck(
                    [p1, p2],
                    just,
                    pos,
                    textWidth,
                    11 / viewportScale,
                    externalLabels,
                    country.id
                )
                if (h.length == 2) {
                    let markerEnding = markerEndPosition(
                        pos,
                        h,
                        textWidth,
                        11 / viewportScale
                    )
                    externalLabels.push([
                        [h[0], h[1]],
                        [h[0] + textWidth, h[1]],
                        [h[0] + textWidth, h[1] - 11 / viewportScale],
                        [h[0], h[1] - 11 / viewportScale],
                    ])
                    //TODO: not working. needs fixing
                    if (
                        pos == externalPositions.left ||
                        pos == externalPositions.right
                    )
                        externalLabels.push([
                            [pole[0], pole[1] - 1],
                            [pole[0], pole[1] + 1],
                            [markerEnding[0], markerEnding[1] + 1],
                            [markerEnding[0], markerEnding[1] - 1],
                        ])
                    else if (
                        pos == externalPositions.top ||
                        pos == externalPositions.bottom
                    )
                        externalLabels.push([
                            [pole[0] - 1, pole[1]],
                            [pole[0] + 1, pole[1]],
                            [markerEnding[0] + 1, markerEnding[1]],
                            [markerEnding[0] - 1, markerEnding[1]],
                        ])
                    else if (
                        pos == externalPositions.bottomLeft ||
                        pos == externalPositions.topRight
                    )
                        externalLabels.push([
                            [pole[0] - 0.707, pole[1] - 0.707],
                            [pole[0] + 0.707, pole[1] + 0.707],
                            [markerEnding[0] + 0.707, markerEnding[1] + 0.707],
                            [markerEnding[0] - 0.707, markerEnding[1] - 0.707],
                        ])
                    else if (
                        pos == externalPositions.topLeft ||
                        pos == externalPositions.bottomRight
                    )
                        externalLabels.push([
                            [pole[0] - 0.707, pole[1] + 0.707],
                            [pole[0] + 0.707, pole[1] - 0.707],
                            [markerEnding[0] + 0.707, markerEnding[1] - 0.707],
                            [markerEnding[0] - 0.707, markerEnding[1] + 0.707],
                        ])
                    return {
                        id: country.id,
                        position: new PointVector(h[0], h[1]),
                        value: value,
                        size: 11 / viewportScale,
                        type: "external",
                        pole: pole,
                        markerEnd: markerEnding,
                    }
                }
            }
        }
        return {
            id: country.id,
            position: new PointVector(p1, p2),
            size: minSize / viewportScale,
            type: "external",
            pole: pole,
        }
    })
    return retVal
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

function yessir(data: RenderFeature[]): Position[][] {
    let allPoints: Position[][] = []
    data.map(function (country) {
        if (country.geo.geometry.type === "Polygon") {
            let regionPath = country.path.slice(1, -1).split("L")
            allPoints.push(
                regionPath.map((temp) => [
                    Number(temp.substring(0, temp.indexOf(","))),
                    Number(temp.substring(temp.indexOf(",") + 1)),
                ])
            )
        } else {
            let countryPaths = country.path.slice(1, -1).split("ZM")
            for (const region of countryPaths) {
                let regionPath = region.split("L")
                allPoints.push(
                    regionPath.map((temp) => [
                        Number(temp.substring(0, temp.indexOf(","))),
                        Number(temp.substring(temp.indexOf(",") + 1)),
                    ])
                )
            }
        }
    })
    return allPoints
}

function externalCheck(
    point: number[],
    allPoints: Position[][],
    type: externalPositions,
    textWidth: number,
    fontSize: number,
    externalLabels: Position[][],
    id: string
): number[] {
    let k1 = [point[0], point[1]]
    let i = 0
    let g1 = false
    let shoulder: Position[] = []
    while (true) {
        let tt = true
        if (i > 25) break
        if (i == 0) {
            for (const x of allPoints) {
                if (insideCheck(k1, x)) {
                    shoulder = x
                    break
                }
            }
        } else if (!insideCheck(k1, shoulder)) {
            for (const x of allPoints) {
                if (insideCheck(k1, x)) {
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
                        x
                    ) ||
                    insideCheck(k1, x)
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
            return point
        case externalPositions.left:
            return [point[0] + textWidth, point[1]]
        case externalPositions.topRight:
            return point
        case externalPositions.bottomRight:
            return point
        case externalPositions.topLeft:
            return [point[0] + textWidth, point[1]]
        case externalPositions.bottomLeft:
            return [point[0] + textWidth, point[1] - fontSize]
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
