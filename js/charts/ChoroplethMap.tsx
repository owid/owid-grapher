// @flow

import * as _ from 'lodash'
import * as d3 from 'd3'
import Bounds from './Bounds'
import * as React from 'react'
import {observable, computed, asFlat, asStructure, autorunAsync, action} from 'mobx'
import {observer} from 'mobx-react'
import {bind} from 'decko'
import * as topojson from 'topojson'
import MapProjections from './MapProjections'
import MapTopology from './MapTopology'

export type ChoroplethData = {
    [key:string]: {
        color: string,
        highlightFillColor: string,
        value: number,
        year: number
    }
};

export type MapProjection = 'World' | 'Africa' | 'N.America' | 'S.America' | 'Asia' | 'Europe' | 'Australia';

type GeoFeature = GeoJSON.Feature<GeoJSON.GeometryObject>
type MapBracket = any
type MapEntity = any

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
export default class ChoroplethMap extends React.Component<ChoroplethMapProps, null> {
    subunits: any

    @computed get geoData(): GeoFeature[] {
        return topojson.feature(MapTopology, MapTopology.objects.world).features.filter(function(feature) {
            return feature.id !== "ATA";
        });
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

    @computed get pathData(): { [key: string]: string } {
        const {geoData, projection} = this

        const pathData: { [key: string]: string } = {}
        const pathF = MapProjections[projection]().path;

        _.each(geoData, (d) => {
            pathData[d.id] = pathF(d)
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
        const {choroplethData, focusBracket, focusEntity} = this
        if (focusEntity && focusEntity.id == geo.id)
            return true

        const datum = choroplethData[geo.id]
        if (datum == null && focusBracket && focusBracket.value == "No data")
            return true
        else if (focusBracket && focusBracket.contains(datum))
            return true
        else
            return false
    }

    render() {
        const { bounds, choroplethData, defaultFill, geoData, pathData, hasFocus } = this
        const focusColor = "#FFEC38"
        const focusStrokeWidth = 2.5

        return <g className="map" clip-path="url(#boundsClip)">
            <defs>
                <clipPath id="boundsClip">
                    <rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height}></rect>
                </clipPath>
            </defs>
            <g className="subunits" ref={g => this.subunits = g}>
                {_.map(geoData.filter(d => !choroplethData[d.id]), d => {
                    const isFocus = this.hasFocus(d)
                    const stroke = isFocus ? focusColor : "#333"
                    return <path key={d.id} d={pathData[d.id]} stroke-width={isFocus ? focusStrokeWidth : 0.3} stroke={stroke} cursor="pointer" fill={defaultFill} onMouseEnter={(ev) => this.props.onHover(d, ev)} onMouseLeave={this.props.onHoverStop} onClick={(ev) => this.props.onClick(d)}/>
                })}

                {_.sortBy(_.map(geoData.filter(d => choroplethData[d.id]), (d) => {
                    const isFocus = this.hasFocus(d)
                    const datum = choroplethData[d.id]
                    const stroke = isFocus ? focusColor : "#333"
                    const fill = datum ? datum.color : defaultFill

                    return [
                        <path key={d.id} d={pathData[d.id]} stroke-width={isFocus ? focusStrokeWidth : 0.5} stroke={stroke} cursor="pointer" fill={fill} onMouseEnter={(ev) => this.props.onHover(d, ev)} onMouseLeave={this.props.onHoverStop} onClick={(ev) => this.props.onClick(d)}/>
                    ]
                }), p => p[0].props['stroke-width'])}
            </g>
            {/*<text className="disclaimer" x={bounds.left+bounds.width-5} y={bounds.top+bounds.height-10} font-size="0.5em" text-anchor="end">
                Mapped on current borders
            </text>*/}
        </g>
    }

    componentDidMount() {
        this.postRenderResize()
        autorunAsync(this.postRenderResize)
    }

    @bind postRenderResize() {
        let { bounds, projection, subunits } = this
        const bbox = subunits.getBBox()

        var viewports = {
            "World": { x: 0.565, y: 0.5, width: 1, height: 1 },
            "Africa": { x: 0.48, y: 0.70, width: 0.21, height: 0.38 },
            "N.America": { x: 0.49, y: 0.40, width: 0.19, height: 0.32 },
            "S.America": { x: 0.52, y: 0.815, width: 0.10, height: 0.26 },
            "Asia": { x: 0.49, y: 0.52, width: 0.22, height: 0.38 },
            "Australia": { x: 0.51, y: 0.77, width: 0.1, height: 0.12 },
            "Europe": { x: 0.54, y: 0.54, width: 0.05, height: 0.15 },
        };

        var viewport = viewports[projection];

        // Calculate our reference dimensions. All of these values are independent of the current
        // map translation and scaling-- getBBox() gives us the original, untransformed values.
        var mapX = bbox.x + 1,
            mapY = bbox.y + 1,
            viewportWidth = viewport.width*bbox.width,
            viewportHeight = viewport.height*bbox.height;

        // Calculate what scaling should be applied to the untransformed map to match the current viewport to the container
        var scale = Math.min(bounds.width/viewportWidth, bounds.height/viewportHeight);

        // Work out how to center the map, accounting for the new scaling we've worked out
        var newWidth = bbox.width*scale,
            newHeight = bbox.height*scale,
            boundsCenterX = bounds.left + bounds.width/2,
            boundsCenterY = bounds.top + bounds.height/2,
            newCenterX = mapX + (scale-1)*bbox.x + viewport.x*newWidth,
            newCenterY = mapY + (scale-1)*bbox.y + viewport.y*newHeight,
            newOffsetX = boundsCenterX - newCenterX,
            newOffsetY = boundsCenterY - newCenterY;

        var matrixStr = "matrix(" + scale + ",0,0," + scale + "," + newOffsetX + "," + newOffsetY + ")";
        d3.select(subunits).attr('transform', matrixStr);
    }
}
