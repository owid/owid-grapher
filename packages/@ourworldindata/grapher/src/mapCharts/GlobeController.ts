import { FeatureCollection } from "geojson"
import { geoInterpolate, geoOrthographic, geoPath } from "d3-geo"
import { interpolateNumber } from "d3-interpolate"
import { easeCubicOut } from "d3-ease"
import * as R from "remeda"
import { EntityName, GlobeConfig, GlobeRegionName } from "@ourworldindata/types"
import {
    Bounds,
    excludeUndefined,
    PartialBy,
    PointVector,
    checkIsOwidContinent,
    getCountryNamesForRegion,
    getRegionByName,
    checkHasMembers,
} from "@ourworldindata/utils"
import { MapConfig } from "./MapConfig"
import { getGeoFeaturesForGlobe } from "./GeoFeatures"
import {
    DEFAULT_GLOBE_ROTATION,
    DEFAULT_GLOBE_ROTATIONS_FOR_TIME,
    DEFAULT_GLOBE_SIZE,
    GeoFeature,
    GLOBE_COUNTRY_ZOOM,
    GLOBE_LATITUDE_MAX,
    GLOBE_LATITUDE_MIN,
    GLOBE_MAX_ZOOM,
    GLOBE_MIN_ZOOM,
    GLOBE_VIEWPORTS,
    GlobeRenderFeature,
    MAP_REGION_NAMES,
} from "./MapChartConstants"
import { isPointPlacedOnVisibleHemisphere } from "./MapHelpers"
import { ckmeans } from "simple-statistics"
import { MapSelectionArray } from "../selection/MapSelectionArray"
import { center } from "@turf/center"

const geoFeaturesById = new Map<string, GlobeRenderFeature>(
    getGeoFeaturesForGlobe().map((f: GlobeRenderFeature) => [f.id, f])
)

const LONGITUDE_OFFSET = 40
const ANIMATION_DURATION = 600

interface Target {
    coords: [number, number]
    zoom: number
}

interface GlobeControllerManager {
    mapConfig: MapConfig
}

export class GlobeController {
    private manager: GlobeControllerManager

    constructor(manager: GlobeControllerManager) {
        this.manager = manager
    }

    private get globeConfig(): GlobeConfig {
        return this.manager.mapConfig.globe
    }

    showGlobe(): void {
        this.globeConfig.isActive = true
    }

    hideGlobe(): void {
        this.globeConfig.isActive = false
    }

    toggleGlobe(): void {
        this.globeConfig.isActive = !this.globeConfig.isActive
    }

    resetGlobe(): void {
        this.globeConfig.rotation = DEFAULT_GLOBE_ROTATION
        this.globeConfig.zoom = 1
    }

    private jumpTo(target: Partial<Target>): void {
        if (target.coords) this.globeConfig.rotation = target.coords
        if (target.zoom) this.globeConfig.zoom = target.zoom
    }

    private showGlobeAndRotateTo(target: Target): void {
        // if the globe isn't currently shown, jump to the offset position
        // before switching to it so that rotating is predictable
        if (!this.globeConfig.isActive) {
            this.jumpTo({ coords: addLongitudeOffset(target.coords) })
            this.showGlobe()
        }

        void this.rotateTo(target)
    }

    jumpToOwidContinent(continent: GlobeRegionName): void {
        const target = calculateTargetForOwidContinent(continent)
        this.jumpTo(target)
    }

    rotateToCountry(country: EntityName, zoom?: number): void {
        const target = calculateTargetForCountry(country, zoom)
        if (target) this.showGlobeAndRotateTo(target)
    }

    rotateToOwidContinent(continent: GlobeRegionName): void {
        const target = calculateTargetForOwidContinent(continent)
        this.showGlobeAndRotateTo(target)
    }

    rotateToDefaultBasedOnTime(): void {
        const target = calculateTargetBasedOnTime()
        this.showGlobeAndRotateTo(target)
    }

    rotateToSelection(): void {
        const target = calculateTargetForSelection(
            this.manager.mapConfig.selection
        )
        if (target) this.showGlobeAndRotateTo(target)
    }

    rotateToRegion(regionName: string): void {
        const target = calculateTargetForRegion(regionName)
        if (target) this.showGlobeAndRotateTo(target)
    }

    private currentAnimation?: AbortController
    private async rotateTo(target: PartialBy<Target, "zoom">): Promise<void> {
        // cancel any ongoing rotation
        if (this.currentAnimation) {
            this.currentAnimation.abort()
            this.currentAnimation = undefined
        }

        // set up a new abort controller
        const controller = new AbortController()
        this.currentAnimation = controller

        try {
            await this._rotateTo(controller.signal, target.coords, target.zoom)
        } catch {
            // aborted
        } finally {
            if (this.currentAnimation === controller) {
                this.currentAnimation = undefined
            }
        }
    }

    private async _rotateTo(
        signal: AbortSignal,
        targetCoords: [number, number],
        targetZoom?: number
    ): Promise<void> {
        const currentCoords = this.globeConfig.rotation
        const animatedCoords = geoInterpolate(currentCoords, targetCoords)

        const currentZoom = this.globeConfig.zoom
        const animatedZoom =
            targetZoom !== undefined
                ? interpolateNumber(currentZoom, targetZoom)
                : undefined

        const animPromise = new Promise<void>((resolve, reject) => {
            const now = Date.now()
            const step = (): void => {
                const elapsed = Date.now() - now
                const t = Math.min(1, elapsed / ANIMATION_DURATION)

                // Check if the animation was canceled
                if (signal.aborted) {
                    reject()
                    return
                }

                // animate globe rotation
                this.globeConfig.rotation = animatedCoords(easeCubicOut(t))

                // animate zoom
                if (animatedZoom)
                    this.globeConfig.zoom = animatedZoom(easeCubicOut(t))

                if (t < 1) {
                    requestAnimationFrame(step)
                } else {
                    resolve()
                }
            }
            requestAnimationFrame(step)
        })

        await animPromise
            .catch(() => {
                // ignore
            })
            .then(() => {
                // ensure we end exactly at the target values
                this.globeConfig.rotation = targetCoords
                if (targetZoom !== undefined) this.globeConfig.zoom = targetZoom
            })
    }
}

function calculateTargetForCountry(
    country: EntityName,
    zoom?: number
): Target | undefined {
    const geoFeature = geoFeaturesById.get(country)
    if (!geoFeature) return

    const coords: [number, number] = [
        geoFeature.geoCentroid[0],
        R.clamp(geoFeature.geoCentroid[1], {
            min: GLOBE_LATITUDE_MIN,
            max: GLOBE_LATITUDE_MAX,
        }),
    ]

    // make sure the whole country is visible after zooming
    const zoomToFit = calculateZoomToFitForGeoFeature(geoFeature.geo)
    const targetZoom = Math.min(zoom ?? GLOBE_COUNTRY_ZOOM, zoomToFit)

    return { coords, zoom: targetZoom }
}

function calculateZoomToFitForGeoFeature(geoFeature: GeoFeature): number {
    const centerPoint = getCenterPoint(geoFeature)
    const projection = geoOrthographic().rotate(negateCoords(centerPoint))

    const corners = geoPath().projection(projection).bounds(geoFeature)
    const bounds = Bounds.fromCorners(
        new PointVector(...corners[0]),
        new PointVector(...corners[1])
    )

    return calculateZoomToFitForBounds(bounds)
}

function calculateZoomToFitForBounds(bounds: Bounds): number {
    // calculate the zoom needed for the bounds to be visible
    let zoom = Math.min(
        DEFAULT_GLOBE_SIZE / bounds.width,
        DEFAULT_GLOBE_SIZE / bounds.height
    )
    if (Number.isNaN(zoom)) zoom = 1

    // it's nicer to have a bit of padding around the zoomed-to area
    zoom = zoom - 0.05

    // clamp the zoom to the allowed range
    zoom = R.clamp(zoom, { min: GLOBE_MIN_ZOOM, max: GLOBE_MAX_ZOOM })

    return zoom
}

function calculateTargetForOwidContinent(continent: GlobeRegionName): Target {
    const viewport = GLOBE_VIEWPORTS[continent]
    return { coords: viewport.rotation, zoom: viewport.zoom }
}

function calculateTargetBasedOnTime(): Target {
    const coords = getCoordsBasedOnTime()
    return { coords, zoom: 1 }
}

function calculateTargetForRegion(regionName: string): Target | undefined {
    const region = getRegionByName(regionName)
    if (!region || !checkHasMembers(region)) return
    const countryNames = getCountryNamesForRegion(region)
    return calculateTargetForCountryCollection(countryNames)
}

function calculateTargetForSelection(
    selection: MapSelectionArray
): Target | undefined {
    // if at least one country is selected, then rotate to the countries (and ignore the regions)
    if (selection.selectedCountryNamesInForeground.length > 0) {
        return calculateTargetForCountryCollection(
            selection.selectedCountryNamesInForeground
        )
    }

    // if a single owid continent is selected, then rotate to it
    // (the hard-coded coords/zoom values are nicer than dynamically computing it)
    if (
        selection.selectedRegions.length === 1 &&
        checkIsOwidContinent(selection.selectedRegions[0])
    ) {
        return calculateTargetForOwidContinent(
            MAP_REGION_NAMES[
                selection.selectedRegions[0].name
            ] as GlobeRegionName
        )
    }

    // rotate and zoom to all countries in the selected regions
    const countryNames = [
        ...selection.selectedCountryNamesInForeground,
        ...selection.countryNamesForSelectedRegions,
    ]
    return calculateTargetForCountryCollection(countryNames)
}

function calculateTargetForCountryCollection(
    countryNames: string[]
): Target | undefined {
    // early return if the selection is empty or a single country is selected
    if (countryNames.length === 0) return
    if (countryNames.length === 1) {
        return calculateTargetForCountry(countryNames[0])
    }

    // find a subset of countries that can be shown on the globe,
    // e.g. if 'Mexico', 'Guatemala' and 'Australia' are selected, then
    // 'Australia' is dropped as it's on the opposite site from South America
    const visibleCountries = findVisibleCountrySubset(countryNames)

    // early return if no country or a single country is visible
    if (visibleCountries.length === 0) return
    if (visibleCountries.length === 1) {
        return calculateTargetForCountry(visibleCountries[0])
    }

    // calculate target coords and zoom for two or more countries
    return getCoordsAndZoomForCountryCollection(visibleCountries)
}

function getCoordsBasedOnTime(): [number, number] {
    const date = new Date()
    const hours = date.getUTCHours()

    if (hours <= 7) {
        return DEFAULT_GLOBE_ROTATIONS_FOR_TIME.UTC_MORNING
    } else if (hours <= 15) {
        return DEFAULT_GLOBE_ROTATIONS_FOR_TIME.UTC_MIDDAY
    } else {
        return DEFAULT_GLOBE_ROTATIONS_FOR_TIME.UTC_EVENING
    }
}

function getCenterForCountryCollection(
    countryNames: string[]
): [number, number] {
    const featureCollection = makeFeatureCollectionForCountries(countryNames)
    return getCenterPoint(featureCollection)
}

function getCenterPoint(
    geojson: GeoFeature | FeatureCollection
): [number, number] {
    const centerPoint = center(geojson)

    return [
        centerPoint.geometry.coordinates[0],
        R.clamp(centerPoint.geometry.coordinates[1], {
            min: GLOBE_LATITUDE_MIN,
            max: GLOBE_LATITUDE_MAX,
        }),
    ]
}

function getCoordsAndZoomForCountryCollection(countryNames: string[]): {
    coords: [number, number]
    zoom: number
} {
    const centerPoint = getCenterForCountryCollection(countryNames)
    const projection = geoOrthographic().rotate(negateCoords(centerPoint))

    const bounds = excludeUndefined(
        countryNames.map((countryName) => {
            const feature = geoFeaturesById.get(countryName)
            if (!feature) return
            const corners = geoPath().projection(projection).bounds(feature.geo)
            if (corners[0][0] === Number.POSITIVE_INFINITY) return
            return Bounds.fromCorners(
                new PointVector(...corners[0]),
                new PointVector(...corners[1])
            )
        })
    )

    // merge bounds and calculate the zoom needed for the countries to be visible
    const mergedBounds = Bounds.merge(bounds)
    const zoom = calculateZoomToFitForBounds(mergedBounds)

    return { coords: centerPoint, zoom }
}

function findVisibleCountrySubset(countryNames: string[]): string[] {
    // rotate the globe to the center point of all given countries,
    // and find all countries that are then visible on the globe
    const centerPoint = getCenterForCountryCollection(countryNames)
    const projection = geoOrthographic().rotate(negateCoords(centerPoint))
    const visibleCountries = countryNames.filter((countryName) => {
        const feature = geoFeaturesById.get(countryName)
        if (!feature) return false

        // check if the centroid is visible
        const isCentroidVisible = isPointPlacedOnVisibleHemisphere(
            feature.geoCentroid,
            centerPoint
        )
        if (!isCentroidVisible) return false

        // if the centroid is visible, then also check if the bounds are
        // visible (if they're infinite, then they're not)
        const corners = geoPath().projection(projection).bounds(feature.geo)
        if (corners[0][0] === Number.POSITIVE_INFINITY) return false

        return true
    })

    // it's possible for no country to be visible if the countries are on opposite
    // sides from the globe. in that case, we need to drop a subset of countries
    if (visibleCountries.length === 0) {
        // cluster countries into two groups based on their centroid longitude
        const clusters = clusterCountriesByCentroidLongitude(countryNames)

        // keep the bigger cluster
        // (if both clusters have the same number of countries, keep any)
        return clusters[0].length > clusters[1].length
            ? clusters[0]
            : clusters[1]
    }

    return visibleCountries
}

function clusterCountriesByCentroidLongitude(
    countryNames: string[]
): string[][] {
    const nameToLon: Record<string, number> = {}
    const lonToName: Record<number, string> = {}

    // map country names to their centroid's longitude and vice versa
    // (assumes that no two countries have the same longitude)
    countryNames.forEach((countryName) => {
        const feature = geoFeaturesById.get(countryName)
        if (!feature) return

        const lon = R.round(feature.geoCentroid[0], 5)
        nameToLon[countryName] = lon
        lonToName[lon] = countryName
    })

    // cluster longitudes into two groups
    const clusters = ckmeans(
        excludeUndefined(countryNames.map((name) => nameToLon[name])),
        2
    )

    // map longitudes back to country names
    return clusters.map((cluster) =>
        cluster.map((centroidLon) => lonToName[centroidLon])
    )
}

function makeFeatureCollectionForCountries(
    countryNames: string[]
): FeatureCollection {
    const features = excludeUndefined(
        countryNames.map((name) => geoFeaturesById.get(name))
    )

    return {
        type: "FeatureCollection",
        features: features.map((feature) => feature.geo),
    }
}

function addLongitudeOffset(
    coords: [number, number],
    offset = LONGITUDE_OFFSET
): [number, number] {
    return [coords[0] + offset, coords[1]]
}

function negateCoords(coords: [number, number]): [number, number] {
    return [-coords[0], -coords[1]]
}
