import * as React from 'react'
import { computed } from 'mobx'
import { observer } from 'mobx-react'
import * as topojson from 'topojson'

import { map, min, max, each, identity, sortBy, guid } from './Util'
import Bounds from './Bounds'
import MapProjections from './MapProjections'
import MapProjection from './MapProjection'
import MapTopology from './MapTopology'
import Vector2 from './Vector2'
import { worldRegionByMapEntity } from './WorldRegions'

export interface ChoroplethDatum {
    entity: string
    year: number
    value: number | string
    color: string
    highlightFillColor: string
}

export interface ChoroplethData {
    [key: string]: ChoroplethDatum
}

export type GeoFeature = GeoJSON.Feature<GeoJSON.GeometryObject>
export type MapBracket = any
export type MapEntity = any

interface ChoroplethMapProps {
    choroplethData: ChoroplethData,
    bounds: Bounds,
    projection: MapProjection,
    defaultFill: string,
    focusBracket: MapBracket,
    focusEntity: MapEntity,
    onClick: (d: GeoFeature) => void,
    onHover: (d: GeoFeature, ev: React.MouseEvent<SVGPathElement>) => void,
    onHoverStop: () => void
}

@observer
export default class ChoroplethMap extends React.Component<ChoroplethMapProps> {
    subunits: any

    @computed get uid(): number {
        return guid()
    }

    // Get the underlying geographical topology elements we're going to display
    @computed get geoData(): GeoFeature[] {
        let geoData = (topojson.feature(MapTopology, MapTopology.objects.world) as any).features

        // Filter out Antarctica
        geoData = geoData.filter((feature: any) => feature.id !== "ATA")

        return geoData
    }

    @computed.struct get projection(): MapProjection {
        return this.props.projection
    }

    @computed.struct get bounds(): Bounds {
        return this.props.bounds
    }

    @computed.struct get choroplethData(): ChoroplethData {
        return this.props.choroplethData
    }

    @computed.struct get defaultFill(): string {
        return this.props.defaultFill
    }

    @computed get geoPath() {
        return MapProjections[this.projection]
    }

    @computed get geoBounds() {
        const { geoData, geoPath } = this
        const allBounds = map(geoData, geoPath.bounds)
        const x1 = min(map(allBounds, b => b[0][0])) as number
        const y1 = min(map(allBounds, b => b[0][1])) as number
        const x2 = max(map(allBounds, b => b[1][0])) as number
        const y2 = max(map(allBounds, b => b[1][1])) as number
        return Bounds.fromCorners(new Vector2(x1, y1), new Vector2(x2, y2))
    }

    @computed get pathData(): { [key: string]: string } {
        const { geoData, geoPath } = this

        const pathData: { [key: string]: string } = {}

        each(geoData, (d) => {
            const s = geoPath(d) as string
            const paths = s.split(/Z/).filter(identity)

            const newPaths = paths.map(path => {
                const points = path.split(/[MLZ]/).filter((f: any) => f)
                const rounded = points.map(p => p.split(/,/).map(v => parseFloat(v).toFixed(1)).join(','))
                return "M" + rounded.join("L")
            })
            pathData[d.id as string] = newPaths.join("Z") + "Z"
        })

        return pathData
    }

    @computed get focusBracket(): MapBracket {
        return this.props.focusBracket
    }

    @computed get focusEntity(): MapEntity {
        return this.props.focusEntity
    }

    // Check if a geo entity is currently focused, either directly or via the bracket
    hasFocus(geo: GeoFeature) {
        const { choroplethData, focusBracket, focusEntity } = this
        if (focusEntity && focusEntity.id === geo.id)
            return true
        else if (!focusBracket)
            return false

        const datum = choroplethData[geo.id as string] || null
        if (focusBracket.contains(datum))
            return true
        else
            return false
    }

    // Viewport for each projection, defined by center and width+height in fractional coordinates
    @computed get viewport() {
        const viewports = {
            "World": { x: 0.565, y: 0.5, width: 1, height: 1 },
            "Europe": { x: 0.5, y: 0.22, width: 0.2, height: 0.2 },
            "Africa": { x: 0.49, y: 0.70, width: 0.21, height: 0.38 },
            "NorthAmerica": { x: 0.49, y: 0.40, width: 0.19, height: 0.32 },
            "SouthAmerica": { x: 0.52, y: 0.815, width: 0.10, height: 0.26 },
            "Asia": { x: 0.75, y: 0.45, width: 0.3, height: 0.5 },
            "Oceania": { x: 0.51, y: 0.75, width: 0.1, height: 0.2 },
        }

        return viewports[this.projection]
    }

    // Calculate what scaling should be applied to the untransformed map to match the current viewport to the container
    @computed get viewportScale() {
        const {bounds, viewport, geoBounds} = this
        const viewportWidth = viewport.width * geoBounds.width
        const viewportHeight = viewport.height * geoBounds.height
        return Math.min(bounds.width / viewportWidth, bounds.height / viewportHeight)
    }

    @computed get matrixTransform() {
        const { bounds, projection, geoBounds, viewport, viewportScale } = this

        // Calculate our reference dimensions. These values are independent of the current
        // map translation and scaling.
        const mapX = geoBounds.x + 1
        const mapY = geoBounds.y + 1

        // Work out how to center the map, accounting for the new scaling we've worked out
        const newWidth = geoBounds.width * viewportScale
        const newHeight = geoBounds.height * viewportScale
        const boundsCenterX = bounds.left + bounds.width / 2
        const boundsCenterY = bounds.top + bounds.height / 2
        const newCenterX = mapX + (viewportScale - 1) * geoBounds.x + viewport.x * newWidth
        const newCenterY = mapY + (viewportScale - 1) * geoBounds.y + viewport.y * newHeight
        const newOffsetX = boundsCenterX - newCenterX
        const newOffsetY = boundsCenterY - newCenterY

        const matrixStr = `matrix(${viewportScale},0,0,${viewportScale},${newOffsetX},${newOffsetY})`
        return matrixStr
    }

    render() {
        const { uid, bounds, choroplethData, defaultFill, geoData, pathData, matrixTransform, projection, viewportScale } = this
        const focusColor = "#FFEC38"
        const focusStrokeWidth = 2.5

        const nonRegionFeatures = []
        const noDataFeatures = []
        const dataFeatures = []
        for (const feature of geoData) {
            if (projection !== "World" && worldRegionByMapEntity[feature.id as string] !== projection)
                nonRegionFeatures.push(feature)
            else if (!choroplethData[feature.id as string])
                noDataFeatures.push(feature)
            else
                dataFeatures.push(feature)
        }

        return <g className="ChoroplethMap" clip-path={`url(#boundsClip-${uid})`}>
            <defs>
                <clipPath id={`boundsClip-${uid}`}>
                    <rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height}></rect>
                </clipPath>
            </defs>
            <g className="subunits" transform={matrixTransform}>
                {nonRegionFeatures.length && <g className="nonRegionFeatures">
                    {nonRegionFeatures.map(d => {
                        return <path key={d.id} d={pathData[d.id as string]} strokeWidth={0.3/viewportScale} stroke={"#ccc"} fill={"#efefef"}/>
                    })}
                </g>}

                {noDataFeatures.length && <g className="noDataFeatures">
                    {noDataFeatures.map(d => {
                        const isFocus = this.hasFocus(d)
                        const stroke = isFocus ? focusColor : "#333"
                        return <path key={d.id} d={pathData[d.id as string]} strokeWidth={(isFocus ? focusStrokeWidth : 0.3)/viewportScale} stroke={stroke} cursor="pointer" fill={defaultFill} onMouseEnter={(ev) => this.props.onHover(d, ev)} onMouseLeave={this.props.onHoverStop} onClick={() => this.props.onClick(d)} />
                    })}
                </g>}

                {sortBy(dataFeatures.map(d => {
                    const isFocus = this.hasFocus(d)
                    const datum = choroplethData[d.id as string]
                    const stroke = isFocus ? focusColor : "#333"
                    const fill = datum ? datum.color : defaultFill

                    return [
                        <path key={d.id} d={pathData[d.id as string]} strokeWidth={(isFocus ? focusStrokeWidth : 0.3)/viewportScale} stroke={stroke} cursor="pointer" fill={fill} onMouseEnter={(ev) => this.props.onHover(d, ev)} onMouseLeave={this.props.onHoverStop} onClick={() => this.props.onClick(d)} />
                    ]
                }), p => p[0].props['strokeWidth'])}
            </g>
            {/*<text className="disclaimer" x={bounds.left+bounds.width-5} y={bounds.top+bounds.height-10} font-size="0.5em" text-anchor="end">
                Mapped on current borders
            </text>*/}
        </g>
    }
}
