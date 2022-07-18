import { PointVector } from "../../clientUtils/PointVector.js"
import { select } from "d3-selection"
import pixelWidth from "string-pixel-width"
import {
    ChoroplethSeries,
    RenderFeature,
} from "./MapChartConstants.js"

interface internalLabel {
    center: PointVector
    rectPos: PointVector
    height: number
    width: number
    value?: any
    textPos: PointVector
}

export function generateAnnotations(
    featureData: RenderFeature[],
    choroplethData: Map<string, ChoroplethSeries>,
    fontSize: number
): internalLabel[] {
    var retVal = featureData.map(function (country) {
        let countryPath = country.path
        let regionsvg
        let temp: PointVector
        if (country.geo.geometry.type == "Polygon") {
            temp = country.center
            regionsvg = select("svg")
                .append("path")
                .attr("d", country.path)
                .node()
        } else {
            let tempPath
            let maxPath
            maxPath = countryPath.substring(0, countryPath.indexOf("Z") + 1)
            countryPath = countryPath.substring(countryPath.indexOf("Z") + 1)
            while (countryPath.length > 0) {
                tempPath = countryPath.substring(0, countryPath.indexOf("Z") + 1)
                if (tempPath.length > maxPath.length) {
                    maxPath = tempPath
                }
                countryPath = countryPath.substring(countryPath.indexOf("Z") + 1)
            }
            let svg = select("svg").append("path").attr("d", maxPath)
            let bBox = svg.node()?.getBBox()
            regionsvg = select("svg").append("path").attr("d", maxPath).node()
            if (bBox)
                temp = new PointVector(
                    bBox.x + bBox.width / 2,
                    bBox.y + bBox.height / 2
                )
                else {
                    temp = new PointVector(1,1)
                }
        }
        var svgw3 = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
        )
        if (regionsvg) {
            let centerPoint = svgw3.createSVGPoint()
            centerPoint.x = temp.x
            centerPoint.y = temp.y
            let rect1 = svgw3.createSVGPoint()
            rect1.x = temp.x - 0.5
            rect1.y = temp.y - 0.5
            let rect2 = svgw3.createSVGPoint()
            rect2.x = temp.x - 0.5
            rect2.y = temp.y + 0.5
            let rect3 = svgw3.createSVGPoint()
            rect3.x = temp.x + 0.5
            rect3.y = temp.y + 0.5
            let rect4 = svgw3.createSVGPoint()
            rect4.x = temp.x + 0.5
            rect4.y = temp.y - 0.5
            if (
                regionsvg?.isPointInFill(rect1) &&
                regionsvg?.isPointInFill(rect2) &&
                regionsvg?.isPointInFill(rect3) &&
                regionsvg?.isPointInFill(rect4)
            ) {
                let temp1 = svgw3.createSVGPoint()
                let temp2 = svgw3.createSVGPoint()
                let s1 = svgw3.createSVGPoint()
                let s2 = svgw3.createSVGPoint()
                let s3 = svgw3.createSVGPoint()
                let increment = null
                let expand = true
                while (expand) {
                    expand = false
                    if (
                        regionsvg?.isPointInFill(rect1) &&
                        regionsvg?.isPointInFill(rect2)
                    ) {
                        temp1.x = rect1.x - 1
                        temp1.y = rect1.y
                        temp2.x = rect2.x - 1
                        temp2.y = rect2.y
                        ;(s1.x = rect1.x), (s2.x = rect1.x), (s3.x = rect1.x)
                        increment = (temp2.y - temp1.y) / 4
                        s1.y = rect1.y + increment
                        s2.y = s1.y + increment
                        s3.y = s2.y + increment
                        if (
                            regionsvg?.isPointInFill(temp1) &&
                            regionsvg?.isPointInFill(temp2) &&
                            regionsvg?.isPointInFill(s1) &&
                            regionsvg?.isPointInFill(s2) &&
                            regionsvg?.isPointInFill(s3)
                        ) {
                            rect1.x -= 1
                            rect2.x -= 1
                            expand = true
                        }
                    }
                    if (
                        regionsvg?.isPointInFill(rect2) &&
                        regionsvg?.isPointInFill(rect3)
                    ) {
                        temp1.x = rect2.x
                        temp1.y = rect2.y + 1
                        temp2.x = rect3.x
                        temp2.y = rect3.y + 1
                        ;(s1.y = temp2.y), (s2.y = temp2.y), (s3.y = temp2.y)
                        increment = (temp2.x - temp1.x) / 4
                        s1.x = rect2.x + increment
                        s2.x = s1.x + increment
                        s3.x = s2.x + increment
                        if (
                            regionsvg?.isPointInFill(temp1) &&
                            regionsvg?.isPointInFill(temp2) &&
                            regionsvg?.isPointInFill(s1) &&
                            regionsvg?.isPointInFill(s2) &&
                            regionsvg?.isPointInFill(s3)
                        ) {
                            rect2.y += 1
                            rect3.y += 1
                            expand = true
                        }
                    }
                    if (
                        regionsvg?.isPointInFill(rect3) &&
                        regionsvg?.isPointInFill(rect4)
                    ) {
                        temp1.x = rect3.x + 1
                        temp1.y = rect3.y
                        temp2.x = rect4.x + 1
                        temp2.y = rect4.y
                        ;(s1.x = rect3.x), (s2.x = rect3.x), (s3.x = rect3.x)
                        increment = (temp1.y - temp2.y) / 4
                        s1.y = rect4.y + increment
                        s2.y = s1.y + increment
                        s3.y = s2.y + increment
                        if (
                            regionsvg?.isPointInFill(temp1) &&
                            regionsvg?.isPointInFill(temp2) &&
                            regionsvg?.isPointInFill(s1) &&
                            regionsvg?.isPointInFill(s2) &&
                            regionsvg?.isPointInFill(s3)
                        ) {
                            rect3.x += 1
                            rect4.x += 1
                            expand = true
                        }
                    }
                    if (
                        regionsvg?.isPointInFill(rect4) &&
                        regionsvg?.isPointInFill(rect1)
                    ) {
                        temp1.x = rect4.x
                        temp1.y = rect4.y - 1
                        temp2.x = rect1.x
                        temp2.y = rect1.y - 1
                        ;(s1.y = temp1.y), (s2.y = temp1.y), (s3.y = temp1.y)
                        increment = (temp1.x - temp2.x) / 4
                        s1.x = rect1.x + increment
                        s2.x = s1.x + increment
                        s3.x = s2.x + increment
                        if (
                            regionsvg?.isPointInFill(temp1) &&
                            regionsvg?.isPointInFill(temp2) &&
                            regionsvg?.isPointInFill(s1) &&
                            regionsvg?.isPointInFill(s2) &&
                            regionsvg?.isPointInFill(s3)
                        ) {
                            rect4.y -= 1
                            rect1.y -= 1
                            expand = true
                        }
                    }
                }
                let value = choroplethData.get(country.id)?.value
                if(typeof value === 'number')
                value = Math.round(value * 10)/10
                let check = true
                let textPosx
                if (value) {
                    let textWidth = pixelWidth(value.toString(), {
                        size: fontSize,
                        font: "arial",
                    })
                    if (textWidth) {
                        check = textWidth < rect4.x - rect1.x
                        textPosx =
                            rect1.x + (rect4.x - rect1.x) / 2 - textWidth / 2
                    }
                }
                if (fontSize < rect2.y - rect1.y && check) {
                    let textPosy =
                        rect1.y + (rect2.y - rect1.y) / 2 + fontSize / 2
                    return {
                        center: temp,
                        rectPos: new PointVector(rect1.x, rect1.y),
                        height: rect2.y - rect1.y,
                        width: rect4.x - rect1.x,
                        value: value,
                        textPos: new PointVector(
                            textPosx ? textPosx : rect1.x,
                            textPosy
                        ),
                    }
                }
            }
        }

        return {
            center: temp,
            rectPos: temp,
            height: -76,
            width: 1,
            value: "4.0",
            textPos: temp,
        }
    })
    retVal = retVal.filter(function (x) {
        return x.height > 0
    })
    return retVal
}
