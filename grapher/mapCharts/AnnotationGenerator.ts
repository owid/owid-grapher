import { PointVector } from "../../clientUtils/PointVector.js"
import pixelWidth from "string-pixel-width"
import {
    ChoroplethSeries,
    ExternalDirections,
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

interface ExternalInfo {
    id: string
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
    // Reset annotation cache if there is a change in viewportScale
    if (
        !annotationsCache.has(projection) ||
        annotationsCache.get(projection)!.viewportScale != viewportScale
    ) {
        const projectionCache = {
            externalCandidates: [],
            candidateInfo: [],
            regions: [],
            internalInfo: [],
            allPoints: {},
            viewportScale: viewportScale,
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
            const labelPos = candidateInfo.labelPosition as Position
            const marker = candidateInfo.marker as Position[]
            let canFitExternalLabel = true
            // Check to see if label lies within map bounds
            if (
                labelPos[0] + textWidth > bottomRightBound[0] ||
                labelPos[0] < topLeftBound[0] ||
                labelPos[1] > bottomRightBound[1] ||
                labelPos[1] - fontSize < topLeftBound[1]
            )
                canFitExternalLabel = false
            //Collision check between current label and all labels
            if (canFitExternalLabel === true)
                for (const e of externalLabels)
                    if (
                        rectIntersection(
                            getLabelRect(labelPos, textWidth, fontSize),
                            e
                        )
                    ) {
                        canFitExternalLabel = false
                        break
                    }
            // Collision check between:
            // 1) all markers and current marker
            // 2) all markers and current label
            if (canFitExternalLabel === true)
                for (const y of markers)
                    if (
                        lineIntersection(y[0], y[1], marker[0], marker[1]) ||
                        rectIntersection(
                            getLabelRect(labelPos, textWidth, fontSize),
                            y
                        )
                    ) {
                        canFitExternalLabel = false
                        break
                    }
            //Collision check between all labels and current marker
            if (canFitExternalLabel === true)
                for (const e of externalLabels) {
                    if (rectIntersection(e, marker)) {
                        canFitExternalLabel = false
                        break
                    }
                }
            // All checks passed
            if (canFitExternalLabel === true) {
                const externalLabel = getLabelRect(
                    labelPos,
                    textWidth,
                    fontSize
                )
                const externalAnnotation: Annotation = {
                    id: country.id,
                    position: new PointVector(labelPos[0], labelPos[1]),
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
        const internalInfo = internalInfoCache.find(
            (el) => el.id === country.id
        ) as InternalInfo
        const pole = internalInfo.pole
        regionPoints = internalInfo.points
        let t1, t2, t3, t4
        let check = false
        // Check if internal annotation lies within a country's polygon and if so,
        // try to increase the font size as much as possible till it hits maxSize
        while (fontSize < maxSize) {
            textWidth = pixelWidth(value.toString(), {
                size: fontSize / viewportScale,
                font: "arial",
            })
            // Coordinates of the label text with pole of inaccessibility as center
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
        // check is true implies it is confirmed that we have a valid internal annotation
        // otherwise the country is added to externalInfo to check if we can display an
        // external annotation for it
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
            // For MultiPolygon countries, pole of inaccessibility does not necessarily
            // lie in the region with the largest area e.g, Chile. So we need to assign the
            // region with the largest area as the one from which external annotations needs
            // to be marked
            if (country.geo.geometry.type == "MultiPolygon") {
                let maxArea = 0
                for (const el of regionsCache.filter(
                    (el) => el.id == country.id
                )) {
                    const tempArea = polygonArea(el.points)
                    if (tempArea > maxArea) {
                        externalRegion = el.points
                        maxArea = tempArea
                        regionPoints = el.points.slice(0, -1)
                    }
                }
            } else if (country.geo.geometry.type == "Polygon")
                externalRegion = country.geo.geometry.coordinates[0]
            externalInfo.push({
                id: country.id,
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

// Process feasibility and positional info of candidate position and store result within cache.
// This function checks whether the candidate positions and their markers intersect country
// polygons and returns the calculated info of marker and label positions
function getCandidateInfo(
    point: number[],
    regionsCache: Region[],
    direction: ExternalDirections,
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
            el.direction === direction &&
            el.boundaryPosition == point
    )
    if (candidateInfo !== undefined) return candidateInfo
    let anchor = false
    const p = [point[0], point[1]]
    // Get starting position of label text using the starting position of the marker line
    if (direction == ExternalDirections.top) {
        p[0] = p[0] - textWidth / 2
    } else if (direction == ExternalDirections.bottom) {
        p[0] = p[0] - textWidth / 2
        p[1] = p[1] + fontSize
    } else if (direction == ExternalDirections.left) {
        p[0] = p[0] - textWidth
        p[1] = p[1] + fontSize / 2
    } else if (direction == ExternalDirections.right) {
        p[1] = p[1] + fontSize / 2
    } else if (
        direction == ExternalDirections.bottomLeft ||
        direction == ExternalDirections.topLeft
    ) {
        p[0] = p[0] - textWidth
        p[1] = p[1] + fontSize / 2
    }
    let j = 1
    let canAvoidCountries = true
    let markerEnd: Position
    // Check if country area is more than threshold and add length to marking line
    // Otherwise, we don't display the marking line and show an anchor point
    if (country.area / viewportScale > 0.5)
        for (let i = 1; i <= 8; i++)
            externalIncrement(direction, p, viewportScale)
    else anchor = true
    while (j <= 2) {
        canAvoidCountries = true
        externalIncrement(direction, p, viewportScale)
        markerEnd = getMarkerEndPosition(
            direction as ExternalDirections,
            p,
            textWidth,
            fontSize
        )
        for (const x of combinedData) {
            // Explicitly assigning points since Bounds uses PointVector and we require
            // Position direction
            const r1 = [x.bounds.bottomLeft.x, x.bounds.bottomLeft.y]
            const r2 = [x.bounds.bottomRight.x, x.bounds.bottomRight.y]
            const r3 = [x.bounds.topRight.x, x.bounds.topRight.y]
            const r4 = [x.bounds.topLeft.x, x.bounds.topLeft.y]
            const rectPoints = [r1, r2, r3, r4, r1]
            const firstPoint = x.path.slice(1, x.path.indexOf("L")).split(",")
            const labelPoints = [...getLabelRect(p, textWidth, fontSize), p]
            // Check if country lies inside the label
            if (
                polygonContains(
                    [Number(firstPoint[0]), Number(firstPoint[1])],
                    labelPoints
                )
            ) {
                canAvoidCountries = false
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
                        canAvoidCountries = false
                        break
                    }
                }
            }
            // Check if marking line intersects the country's bounds
            // Excluding origin country since marker already touches a border point
            if (
                x.id != country.id &&
                rectIntersection([r1, r2, r3, r4], [point, markerEnd])
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
                            canAvoidCountries = false
                            break
                        }
                    }
            }
        }
        if (canAvoidCountries == true) break
        j++
    }
    if (canAvoidCountries == true) {
        const newobj = {
            id: country.id,
            boundaryPosition: point,
            direction: direction,
            textWidth: textWidth,
            possible: true,
            labelPosition: p,
            anchor: anchor,
            marker: [point, markerEnd!],
        }
        candidateInfoCache.push(newobj)
        return newobj
    }
    // Case where external annotation is not possible for any text value
    const newobj = {
        id: country.id,
        boundaryPosition: point,
        direction: direction,
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
    const ans: { direction: ExternalDirections; point: Position }[] = []
    const allPoints = annotationsCache.get(projection)!.allPoints
    const externalCandidatesCache =
        annotationsCache.get(projection)!.externalCandidates
    const externalCandidates = externalCandidatesCache.find(
        (el) => el.id === country.id
    )
    if (externalCandidates !== undefined) return externalCandidates
    let leftBound = regionPoints[0][0],
        rightBound = regionPoints[0][0],
        topBound = regionPoints[0][1],
        bottomBound = regionPoints[0][1]
    for (const x of regionPoints) {
        if (allPoints[x.join()] > 1) continue
        if (x[0] < leftBound) leftBound = x[0]
        if (x[0] > rightBound) rightBound = x[0]
        if (x[1] < topBound) topBound = x[1]
        if (x[1] > bottomBound) bottomBound = x[1]
    }
    const mid = [(leftBound + rightBound) / 2, (topBound + bottomBound) / 2]
    let left, right, bottom, top
    for (const x of regionPoints) {
        if (allPoints[x.join()] > 1) continue
        //right candidate
        if (
            x[0] > mid[0] &&
            Math.abs(x[1] - mid[1]) < 0.25 * (bottomBound - topBound)
        ) {
            if (
                right === undefined ||
                Math.abs(x[1] - mid[1]) < Math.abs(right[1] - mid[1])
            )
                right = x
        }
        // left candidate
        else if (
            x[0] < mid[0] &&
            Math.abs(x[1] - mid[1]) < 0.25 * (bottomBound - topBound)
        ) {
            if (
                left === undefined ||
                Math.abs(x[1] - mid[1]) < Math.abs(left[1] - mid[1])
            )
                left = x
        }
        //bottom candidate
        else if (
            x[1] > mid[1] &&
            Math.abs(x[0] - mid[0]) < 0.25 * (rightBound - leftBound)
        ) {
            if (
                bottom === undefined ||
                Math.abs(x[0] - mid[0]) < Math.abs(bottom[0] - mid[0])
            )
                bottom = x
        }
        //top candidate
        else if (
            x[1] < mid[1] &&
            Math.abs(x[0] - mid[0]) < 0.25 * (rightBound - leftBound)
        ) {
            if (
                top === undefined ||
                Math.abs(x[0] - mid[0]) < Math.abs(top[0] - mid[0])
            )
                top = x
        }
    }
    // Pushing the candidates in the order preferred for annotating
    // It is preferred to externally annotate to the right of a country
    // followed by left, bottom and top
    if (right != undefined) {
        ans.push({ direction: ExternalDirections.right, point: right })
        ans.push({ direction: ExternalDirections.topRight, point: right })
        ans.push({ direction: ExternalDirections.bottomRight, point: right })
    }
    if (left != undefined) {
        ans.push({ direction: ExternalDirections.left, point: left })
        ans.push({ direction: ExternalDirections.topLeft, point: left })
        ans.push({ direction: ExternalDirections.bottomLeft, point: left })
    }
    if (bottom != undefined) {
        ans.push({ direction: ExternalDirections.bottom, point: bottom })
        ans.push({ direction: ExternalDirections.bottomRight, point: bottom })
        ans.push({ direction: ExternalDirections.bottomLeft, point: bottom })
    }
    if (top != undefined) {
        ans.push({ direction: ExternalDirections.top, point: top })
        ans.push({ direction: ExternalDirections.topRight, point: top })
        ans.push({ direction: ExternalDirections.topLeft, point: top })
    }
    externalCandidatesCache.push({ id: id, positions: ans })
    return { id: id, positions: ans }
}

// Initialize regions, internalInfo, allPoints cache for a projection's annotations
// Polylabel function is used here for obtaining poles of inaccessibility
function setAnnotationCache(
    featureData: RenderFeature[],
    projection: MapProjectionName,
    annotationsCache: Map<MapProjectionName, AnnotationsCache>
): void {
    const regionsCache: Region[] = []
    const allPoints: Record<string, number> = {}
    const internalInfo: InternalInfo[] = []
    for (const country of featureData) {
        let pos
        const geometry = country.geo.geometry
        const path = country.path
        const id = country.id
        let regionPoints: Position[] = []
        if (geometry.type === "Polygon") {
            let maxLength = 0
            const countryPaths = path.slice(1, -1).split("ZM")
            const tempPoints = []
            for (const region of countryPaths) {
                const tempRegion = getRegionPoints(
                    country.id,
                    region,
                    regionsCache,
                    allPoints
                )
                tempPoints.push(tempRegion)
                // Pick region with most points for geojson of type "Polygon"
                // The only country whose geojson has multiple polygons is South Africa
                if (tempPoints[tempPoints.length - 1].length > maxLength) {
                    maxLength = tempPoints[tempPoints.length - 1].length
                    regionPoints = tempPoints[tempPoints.length - 1]
                }
            }
            pos = polylabelStretched(tempPoints)
        } else {
            let maxDist = 0
            const countryPaths = path.slice(1, -1).split("ZM")
            for (const region of countryPaths) {
                const tempRegion = getRegionPoints(
                    country.id,
                    region,
                    regionsCache,
                    allPoints
                )
                const p = polylabelStretched([tempRegion])
                // Pick region with most inward pole of inaccessibility for MultiPolygon
                if (p.distance > maxDist) {
                    pos = p
                    maxDist = p.distance
                    regionPoints = tempRegion
                }
            }
        }
        internalInfo.push({
            pole: pos.slice(0, 2),
            points: regionPoints,
            id: id,
        })
    }
    annotationsCache.get(projection)!.regions = regionsCache
    annotationsCache.get(projection)!.internalInfo = internalInfo
    annotationsCache.get(projection)!.allPoints = allPoints
}

// Returns Position array from the string path of a region and updates cache for regions and allPoints fields
// in annotationsCache
function getRegionPoints(
    id: string,
    region: string,
    regionsCache: Region[],
    allPoints: Record<string, number>
): Position[] {
    const tempRegion = []
    const regionPath = region.split("L")
    for (const point of regionPath) {
        const x = [
            Number(point.substring(0, point.indexOf(","))),
            Number(point.substring(point.indexOf(",") + 1)),
        ]
        tempRegion.push(x)
        const key = x[0].toString() + "," + x[1].toString()
        if (key in allPoints) allPoints[key]++
        else allPoints[key] = 1
    }
    regionsCache.push({
        id: id,
        points: tempRegion,
    })
    return tempRegion
}

// Returns pole of inaccessibility for the given polygon
function polylabelStretched(coordinates: Position[][]): any {
    const bounds = geoPath().bounds({ type: "Polygon", coordinates })
    const dx = bounds[1][0] - bounds[0][0]
    const dy = bounds[1][1] - bounds[0][1]
    let ratio = dx / (dy || 1)
    const A = 12
    ratio = Math.min(Math.max(ratio, 1 / A), A)
    const polygon = []
    for (const ring of coordinates) {
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
    direction: ExternalDirections,
    point: Position,
    viewportScale: number
): void {
    const inc1 = 1 / viewportScale
    // Choosing 0.707 (1/sqrt(2)) since inc2 is for 45 degree diagonal increments.
    const inc2 = 0.707 / viewportScale
    if (direction == ExternalDirections.right) point[0] = point[0] + inc1
    else if (direction == ExternalDirections.left) point[0] = point[0] - inc1
    else if (direction == ExternalDirections.topRight) {
        point[0] = point[0] + inc2
        point[1] = point[1] - inc2
    } else if (direction == ExternalDirections.bottomRight) {
        point[0] = point[0] + inc2
        point[1] = point[1] + inc2
    } else if (direction == ExternalDirections.topLeft) {
        point[0] = point[0] - inc2
        point[1] = point[1] - inc2
    } else if (direction == ExternalDirections.bottomLeft) {
        point[0] = point[0] - inc2
        point[1] = point[1] + inc2
    } else if (direction == ExternalDirections.bottom) {
        point[1] = point[1] + inc1
    } else if (direction == ExternalDirections.top) {
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
