import { PointVector } from "../../clientUtils/PointVector.js"
import pixelWidth from "string-pixel-width"
import {
    ChoroplethSeries,
    Annotation,
    AnnotationsCache,
    RenderFeature,
    Region,
    InternalInfo,
    ExternalCandidates,
    CandidateInfo,
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
            externalCandidates: [],
            candidateInfo: [],
            regions: [],
            internalInfo: [],
            allPoints: {},
        }
        annotationsCache.set(projection, projectionCache)
        setAnnotationCache(combinedData, projection, annotationsCache)
    }
    const regionsCache: Region[] = annotationsCache.get(projection)!.regions
    const candidateInfoCache: CandidateInfo[] =
        annotationsCache.get(projection)!.candidateInfo
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
    const initialData = internalGenerator(
        featureData,
        choroplethData,
        viewportScale,
        projection,
        annotationsCache
    )
    const allAnnotations: Annotation[] = initialData.internalAnnotations
    // Sort by descending area so as to give priority to larger countries
    initialData.externalInfo.sort((a, b) => b.area - a.area)
    for (const country of initialData.externalInfo) {
        const fontSize = EXTERNAL_ANNOTATION_SIZE / viewportScale
        const value = choroplethData.get(country.id)!.shortValue!
        let h = null
        const textWidth = pixelWidth(value.toString(), {
            size: fontSize,
            font: "arial",
        })
        const externalCandidates = getExternalCandidates(
            country,
            projection,
            annotationsCache
        )
        for (const pos of externalCandidates.positions) {
            const candidateInfo = getCandidateInfo(
                pos.point,
                regionsCache,
                pos.direction,
                textWidth,
                fontSize,
                country,
                combinedData,
                viewportScale,
                candidateInfoCache
            )
            if (candidateInfo.possible === false) continue
            h = candidateInfo.finalPosition as Position
            const marker = candidateInfo.marker as Position[]
            let check = true
            // Check to see if label lies within map bounds
            if (
                h[0] + textWidth > bottomRightBound[0] ||
                h[0] < topLeftBound[0] ||
                h[1] > bottomRightBound[1] ||
                h[1] - fontSize < topLeftBound[1]
            )
                check = false
            //Collision check between current label and all labels
            if (check === true)
                for (const e of externalLabels)
                    if (
                        rectIntersection(
                            getLabelRect(h, textWidth, fontSize),
                            e
                        )
                    ) {
                        check = false
                        break
                    }
            // Collision check between:
            // 1) all markers and current marker
            // 2) all markers and current label
            if (check === true)
                for (const y of markers)
                    if (
                        lineIntersection(y[0], y[1], marker[0], marker[1]) ||
                        rectIntersection(
                            getLabelRect(h, textWidth, fontSize),
                            y
                        )
                    ) {
                        check = false
                        break
                    }
            //Collision check between all labels and current marker
            if (check === true)
                for (const e of externalLabels) {
                    if (rectIntersection(e, marker)) {
                        check = false
                        break
                    }
                }
            // All checks passed
            if (check === true) {
                const externalLabel = getLabelRect(h, textWidth, fontSize)
                const externalAnnotation = {
                    id: country.id,
                    position: new PointVector(h[0], h[1]),
                    value: value,
                    size: fontSize,
                    type: "external",
                    pole: country.pole,
                    marker: marker,
                    anchor: candidateInfo.anchor,
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

// Algorithm for generating internal annotations uses https://github.com/mapbox/polylabel
// which is a library made for this very purpose. It gives us the pole of inaccessibility
// for a country, which is an ideal location for placing an annotation inside it.
// The implementation here is derived from:
// https://observablehq.com/d/7c984c2d23c003fe
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
        // Check if internal annotation lies within a country's polygon and if so,
        // try to increase the font size as much as possible till it hits maxSize
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
                !rectIntersection([t1, t2, t3, t4], regionPoints) &&
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
                for (const el of regionsCache.filter(
                    (el) => el.id == country.id
                )) {
                    if (polygonContains(pole, el.points)) {
                        externalRegion = el.points
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

// Process feasibility of candidate position and store result within cache
function getCandidateInfo(
    point: number[],
    regionsCache: Region[],
    type: string,
    textWidth: number,
    fontSize: number,
    country: ExternalInfo,
    combinedData: RenderFeature[],
    viewportScale: number,
    candidateInfoCache: CandidateInfo[]
): CandidateInfo {
    const candidateInfo = candidateInfoCache.find(
        (el) =>
            el.id === country.id &&
            el.textWidth === textWidth &&
            el.labelPosition === type &&
            el.boundaryPosition == point
    )
    if (candidateInfo !== undefined) return candidateInfo
    let anchor = false
    const p = [point[0], point[1]]
    if (type == ExternalDirections.top) {
        p[0] = p[0] - textWidth / 2
    } else if (type == ExternalDirections.bottom) {
        p[0] = p[0] - textWidth / 2
        p[1] = p[1] + fontSize
    } else if (type == ExternalDirections.left) {
        p[0] = p[0] - textWidth
        p[1] = p[1] + fontSize / 2
    } else if (type == ExternalDirections.right) {
        p[1] = p[1] + fontSize / 2
    } else if (
        type == ExternalDirections.bottomLeft ||
        type == ExternalDirections.topLeft
    ) {
        p[0] = p[0] - textWidth
        p[1] = p[1] + fontSize / 2
    }
    let j = 1
    let check = true
    let markerEnd: Position
    if (country.area / viewportScale > 0.5)
        for (let i = 1; i <= 8; i++) externalIncrement(type, p, viewportScale)
    else anchor = true
    while (j <= 2) {
        check = true
        externalIncrement(type, p, viewportScale)
        markerEnd = getMarkerEndPosition(
            type as ExternalDirections,
            p,
            textWidth,
            fontSize
        )
        for (const x of combinedData) {
            const g1 = [x.bounds.bottomLeft.x, x.bounds.bottomLeft.y]
            const g2 = [x.bounds.bottomRight.x, x.bounds.bottomRight.y]
            const g3 = [x.bounds.topRight.x, x.bounds.topRight.y]
            const g4 = [x.bounds.topLeft.x, x.bounds.topLeft.y]
            const rectPoints = [g1, g2, g3, g4, g1]
            const firstPoint = x.path.slice(1, x.path.indexOf("L")).split(",")
            const labelPoints = [...getLabelRect(p, textWidth, fontSize), p]
            // Check if country lies inside the label
            if (
                polygonContains(
                    [Number(firstPoint[0]), Number(firstPoint[1])],
                    labelPoints
                )
            ) {
                check = false
                break
            }
            // Check if label intersects or lies inside the country's bounds
            if (
                rectIntersection(
                    getLabelRect(p, textWidth, fontSize),
                    rectPoints
                ) ||
                polygonContains(p, rectPoints)
            ) {
                const regions = regionsCache.filter((el) => el.id === x.id)
                // Check if label intersects or lies inside the country polygon
                for (const region of regions) {
                    if (
                        rectIntersection(
                            getLabelRect(p, textWidth, fontSize),
                            region.points
                        ) ||
                        polygonContains(p, region.points)
                    ) {
                        check = false
                        break
                    }
                }
            }
            // Check if marking line intersects the country's bounds
            if (
                x.id != country.id &&
                rectIntersection([g1, g2, g3, g4], [point, markerEnd])
            ) {
                const regions = regionsCache.filter((el) => el.id === x.id)
                // Check if marking line intersects the country polygon
                for (const region of regions)
                    for (let i = 0; i < region.points.length - 1; i++) {
                        if (
                            lineIntersection(
                                point,
                                markerEnd,
                                region.points[i],
                                region.points[i + 1]
                            )
                        ) {
                            check = false
                            break
                        }
                    }
            }
        }
        if (check == true) break
        j++
    }
    if (check == true) {
        const newobj = {
            id: country.id,
            boundaryPosition: point,
            labelPosition: type,
            textWidth: textWidth,
            possible: true,
            finalPosition: p,
            anchor: anchor,
            marker: [point, markerEnd!],
        }
        candidateInfoCache.push(newobj)
        return newobj
    }
    const newobj = {
        id: country.id,
        boundaryPosition: point,
        labelPosition: type,
        textWidth: textWidth,
        possible: false,
    }
    candidateInfoCache.push(newobj)
    return newobj
}

// Returns all candidate positions and associated directions for which the start coordinate
// of the marking line is feasible. There are 4 possible candidate positions for a country -
// top, bottom, left and right. Each has one vertical/horizontal and two diagonal directions
// for the respective marking line.
function getExternalCandidates(
    country: ExternalInfo,
    projection: MapProjectionName,
    annotationsCache: Map<MapProjectionName, AnnotationsCache>
): ExternalCandidates {
    const id = country.id
    const regionPoints = country.regionPoints
    const ans: { direction: string; point: Position }[] = []
    const allPoints = annotationsCache.get(projection)!.allPoints
    const externalCandidatesCache =
        annotationsCache.get(projection)!.externalCandidates
    const externalCandidates = externalCandidatesCache.find(
        (el) => el.id === country.id
    )
    if (externalCandidates !== undefined) return externalCandidates
    let left = regionPoints[0][0],
        right = regionPoints[0][0],
        top = regionPoints[0][1],
        bottom = regionPoints[0][1]
    let r1, r2, r3, r4
    let j1 = 0,
        j2 = 0
    for (const x of regionPoints) {
        if (x[0] < left) left = x[0]
        if (x[0] > right) right = x[0]
        if (x[1] < top) top = x[1]
        if (x[1] > bottom) bottom = x[1]
    }
    j1 = (left + right) / 2
    j2 = (top + bottom) / 2
    for (const x of regionPoints) {
        if (allPoints[x.join()] > 1) continue
        // left mid
        if (x[0] < j1 && Math.abs(x[1] - j2) < 0.25 * (bottom - top)) {
            if (r1 === undefined || Math.abs(x[1] - j2) < Math.abs(r1[1] - j2))
                r1 = x
        }
        //right mid
        else if (x[0] > j1 && Math.abs(x[1] - j2) < 0.25 * (bottom - top)) {
            if (r2 === undefined || Math.abs(x[1] - j2) < Math.abs(r2[1] - j2))
                r2 = x
        }
        //bottom mid
        else if (x[1] > j2 && Math.abs(x[0] - j1) < 0.25 * (right - left)) {
            if (r3 === undefined || Math.abs(x[0] - j1) < Math.abs(r3[0] - j1))
                r3 = x
        }
        //top mid
        else if (x[1] < j2 && Math.abs(x[0] - j1) < 0.25 * (right - left)) {
            if (r4 === undefined || Math.abs(x[0] - j1) < Math.abs(r4[0] - j1))
                r4 = x
        }
    }
    if (r2 != undefined) {
        ans.push({ direction: ExternalDirections.right, point: r2 })
        ans.push({ direction: ExternalDirections.topRight, point: r2 })
        ans.push({ direction: ExternalDirections.bottomRight, point: r2 })
    }
    if (r1 != undefined) {
        ans.push({ direction: ExternalDirections.left, point: r1 })
        ans.push({ direction: ExternalDirections.topLeft, point: r1 })
        ans.push({ direction: ExternalDirections.bottomLeft, point: r1 })
    }
    if (r3 != undefined) {
        ans.push({ direction: ExternalDirections.bottom, point: r3 })
        ans.push({ direction: ExternalDirections.bottomRight, point: r3 })
        ans.push({ direction: ExternalDirections.bottomLeft, point: r3 })
    }
    if (r4 != undefined) {
        ans.push({ direction: ExternalDirections.top, point: r4 })
        ans.push({ direction: ExternalDirections.topRight, point: r4 })
        ans.push({ direction: ExternalDirections.topLeft, point: r4 })
    }
    externalCandidatesCache.push({ id: id, positions: ans })
    return { id: id, positions: ans }
}

//Initialize cache for a projection's annotations
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

function getRatio(coordinates: any): number {
    const bounds = geoPath().bounds({ type: "Polygon", coordinates })
    const dx = bounds[1][0] - bounds[0][0]
    const dy = bounds[1][1] - bounds[0][1]
    const ratio = dx / (dy || 1)
    const A = 12
    return Math.min(Math.max(ratio, 1 / A), A)
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

// Check if a given rectangle intersects with the lines formed by "segments".
// segments has a length >= 2
function rectIntersection(rect: Position[], segments: Position[]): boolean {
    const p0 = rect[0],
        p1 = rect[1],
        p2 = rect[2],
        p3 = rect[3]
    for (let i = 0; i < segments.length - 1; i++) {
        const v1 = segments[i]
        const v2 = segments[i + 1]
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

// Checks if two line segments intersect
// Source - http://bl.ocks.org/nitaku/fdbb70c3baa36e8feb4e
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

// Returns the end position of the label-marking line for an external annotation.
// The start position is the candidate point on the country's border.
// The positions have been tweaked according to what looks good to the eye.
function getMarkerEndPosition(
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

// Moves the given point by a small increment based on the direction provided.
function externalIncrement(
    type: string,
    point: Position,
    viewportScale: number
): void {
    const inc1 = 1 / viewportScale
    const inc2 = 0.707 / viewportScale
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
}

// Returns coordinates of rectangle with width = textWidth, height = fontSize,
// starting at coordinate = point
function getLabelRect(
    point: Position,
    textWidth: number,
    fontSize: number
): Position[] {
    return [
        point,
        [point[0] + textWidth, point[1]],
        [point[0] + textWidth, point[1] - fontSize],
        [point[0], point[1] - fontSize],
    ]
}

// Replica of polygonArea function in d3-polygon except it returns the unsigned area
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
