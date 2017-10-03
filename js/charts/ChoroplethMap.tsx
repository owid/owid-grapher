import { map, min, max, each, identity, sortBy } from './Util'
import Bounds from './Bounds'
import * as React from 'react'
import { computed } from 'mobx'
import { observer } from 'mobx-react'
import * as topojson from 'topojson'
import MapProjections from './MapProjections'
import MapProjection from './MapProjection'
import MapTopology from './MapTopology'
import Vector2 from './Vector2'

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

    @computed get geoData(): GeoFeature[] {
        return topojson.feature(MapTopology, MapTopology.objects.world).features.filter(feature => feature.id !== "ATA")
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

        const datum = geo.id ? choroplethData[geo.id] : null
        if (focusBracket.contains(datum))
            return true
        else
            return false
    }

    @computed get matrixTransform() {
        const { bounds, projection, geoBounds } = this

        const viewports = {
            "World": { x: 0.565, y: 0.5, width: 1, height: 1 },
            "Africa": { x: 0.48, y: 0.70, width: 0.21, height: 0.38 },
            "NorthAmerica": { x: 0.49, y: 0.40, width: 0.19, height: 0.32 },
            "SouthAmerica": { x: 0.52, y: 0.815, width: 0.10, height: 0.26 },
            "Asia": { x: 0.49, y: 0.52, width: 0.22, height: 0.38 },
            "Australia": { x: 0.51, y: 0.77, width: 0.1, height: 0.12 },
            "Europe": { x: 0.54, y: 0.54, width: 0.05, height: 0.15 },
        }

        const viewport = viewports[projection]

        // Calculate our reference dimensions. All of these values are independent of the current
        // map translation and scaling.
        const mapX = geoBounds.x + 1
        const mapY = geoBounds.y + 1
        const viewportWidth = viewport.width * geoBounds.width
        const viewportHeight = viewport.height * geoBounds.height

        // Calculate what scaling should be applied to the untransformed map to match the current viewport to the container
        const scale = Math.min(bounds.width / viewportWidth, bounds.height / viewportHeight)

        // Work out how to center the map, accounting for the new scaling we've worked out
        const newWidth = geoBounds.width * scale
        const newHeight = geoBounds.height * scale
        const boundsCenterX = bounds.left + bounds.width / 2
        const boundsCenterY = bounds.top + bounds.height / 2
        const newCenterX = mapX + (scale - 1) * geoBounds.x + viewport.x * newWidth
        const newCenterY = mapY + (scale - 1) * geoBounds.y + viewport.y * newHeight
        const newOffsetX = boundsCenterX - newCenterX
        const newOffsetY = boundsCenterY - newCenterY

        const matrixStr = "matrix(" + scale + ",0,0," + scale + "," + newOffsetX + "," + newOffsetY + ")"
        return matrixStr
    }

    render() {
        const { bounds, choroplethData, defaultFill, geoData, pathData, matrixTransform } = this
        const focusColor = "#FFEC38"
        const focusStrokeWidth = 2.5

        return <g className="ChoroplethMap" clip-path="url(#boundsClip)">
            <defs>
                <clipPath id="boundsClip">
                    <rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height}></rect>
                </clipPath>
            </defs>
            <g className="subunits" transform={matrixTransform}>
                {map(geoData.filter(d => !choroplethData[d.id as string]), d => {
                    const isFocus = this.hasFocus(d)
                    const stroke = isFocus ? focusColor : "#333"
                    return <path key={d.id} d={pathData[d.id as string]} stroke-width={isFocus ? focusStrokeWidth : 0.3} stroke={stroke} cursor="pointer" fill={defaultFill} onMouseEnter={(ev) => this.props.onHover(d, ev)} onMouseLeave={this.props.onHoverStop} onClick={() => this.props.onClick(d)} />
                })}

                {sortBy(map(geoData.filter(d => choroplethData[d.id as string]), (d) => {
                    const isFocus = this.hasFocus(d)
                    const datum = choroplethData[d.id as string]
                    const stroke = isFocus ? focusColor : "#333"
                    const fill = datum ? datum.color : defaultFill

                    return [
                        <path key={d.id} d={pathData[d.id as string]} stroke-width={isFocus ? focusStrokeWidth : 0.5} stroke={stroke} cursor="pointer" fill={fill} onMouseEnter={(ev) => this.props.onHover(d, ev)} onMouseLeave={this.props.onHoverStop} onClick={() => this.props.onClick(d)} />
                    ]
                }), p => p[0].props['stroke-width'])}
            </g>
            {/*<text className="disclaimer" x={bounds.left+bounds.width-5} y={bounds.top+bounds.height-10} font-size="0.5em" text-anchor="end">
                Mapped on current borders
            </text>*/}
        </g>
    }
}
