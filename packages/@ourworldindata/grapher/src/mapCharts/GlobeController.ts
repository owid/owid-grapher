import {
    geoCentroid,
    geoDistance,
    geoInterpolate,
    geoOrthographic,
    geoPath,
} from "d3-geo"
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
    GLOBE_COUNTRY_ZOOM,
    GLOBE_LATITUDE_MAX,
    GLOBE_LATITUDE_MIN,
    GLOBE_MAX_ZOOM,
    GLOBE_MIN_ZOOM,
    GLOBE_VIEWPORTS,
    GlobeRenderFeature,
    MAP_REGION_NAMES,
} from "./MapChartConstants"
import { MapSelectionArray } from "../selection/MapSelectionArray"
import { action } from "mobx"

const geoFeaturesById = new Map<string, GlobeRenderFeature>(
    getGeoFeaturesForGlobe().map((f: GlobeRenderFeature) => [f.id, f])
)

const LONGITUDE_OFFSET = 40
const ANIMATION_DURATION = 600

// Used to split countries into two halves of the globe: those within a quarter
// turn of this reference point, and those closer to its antipode.
// The reference point is arbitrary, but it roughly splits the world into the Americas and Europe/Africa/Asia.
const HEMISPHERE_REFERENCE_POINT: [number, number] = [-70, -50] // southern Chile - its antipode is in Mongolia

// Countries whose centroid is further away than this from the globe's center
// point aren't considered visible. that's a little less than the 90 degrees of
// the visible hemisphere, since we can otherwise end up with centroids where the countries themselves are barely visible (e.g. New Zealand and Spain)
const MAX_VISIBLE_CENTROID_DISTANCE = (65 * Math.PI) / 180

interface Target {
    coords: [number, number]
    zoom: number
}

interface GlobeControllerManager {
    mapConfig: MapConfig
}

export class GlobeController {
    private readonly manager: GlobeControllerManager

    constructor(manager: GlobeControllerManager) {
        this.manager = manager
    }

    private get globeConfig(): GlobeConfig {
        return this.manager.mapConfig.globe
    }

    @action.bound showGlobe(): void {
        this.globeConfig.isActive = true
    }

    @action.bound hideGlobe(): void {
        this.globeConfig.isActive = false
    }

    @action.bound toggleGlobe(): void {
        this.globeConfig.isActive = !this.globeConfig.isActive
    }

    @action.bound resetGlobe(): void {
        this.globeConfig.rotation = DEFAULT_GLOBE_ROTATION
        this.globeConfig.zoom = 1
        this.globeConfig.focusCountry = undefined
    }

    @action.bound setFocusCountry(country: EntityName): void {
        this.globeConfig.focusCountry = country
    }

    @action.bound dismissCountryFocus(): void {
        this.globeConfig.focusCountry = undefined
    }

    @action.bound private jumpTo(target: Partial<Target>): void {
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
            const step = action((): void => {
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
            })
            requestAnimationFrame(step)
        })

        await animPromise
            .catch(() => {
                // ignore
            })
            .then(
                action(() => {
                    // ensure we end exactly at the target values
                    this.globeConfig.rotation = targetCoords
                    if (targetZoom !== undefined)
                        this.globeConfig.zoom = targetZoom
                })
            )
    }
}

function calculateTargetForCountry(
    country: EntityName,
    zoom?: number
): Target | undefined {
    const geoFeature = geoFeaturesById.get(country)
    if (!geoFeature) return

    const coords = clampLatitude(geoFeature.geoCentroid)

    // make sure the whole country is visible after zooming
    const zoomToFit = calculateZoomToFitForCountry(geoFeature)
    const targetZoom = Math.min(zoom ?? GLOBE_COUNTRY_ZOOM, zoomToFit)

    return { coords, zoom: targetZoom }
}

function calculateZoomToFitForCountry(feature: GlobeRenderFeature): number {
    const centerPoint = clampLatitude(feature.geoCentroid)
    const projection = geoOrthographic().rotate(negateCoords(centerPoint))

    const corners = geoPath().projection(projection).bounds(feature.geo)
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
    // the spherical centroid of the countries' centroids
    const coordinates = excludeUndefined(
        countryNames.map((name) => geoFeaturesById.get(name)?.geoCentroid)
    )
    const centerPoint = geoCentroid({ type: "MultiPoint", coordinates })

    // the centroid isn't well-defined for all inputs, e.g. there is no single
    // point closest to two exactly antipodal points. d3 returns NaN coords in such cases.
    if (!Number.isFinite(centerPoint[0]) || !Number.isFinite(centerPoint[1]))
        return DEFAULT_GLOBE_ROTATION

    return clampLatitude(centerPoint)
}

function clampLatitude([lon, lat]: [number, number]): [number, number] {
    return [
        lon,
        R.clamp(lat, {
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
    const visibleCountries = countryNames.filter((countryName) => {
        const feature = geoFeaturesById.get(countryName)
        if (!feature) return false

        // check if the centroid is close enough to the center point
        const distance = geoDistance(feature.geoCentroid, centerPoint)
        return distance < MAX_VISIBLE_CENTROID_DISTANCE
    })

    // it's possible for no country to be visible if the countries are on opposite
    // sides from the globe. in that case, we need to drop a subset of countries
    if (visibleCountries.length === 0) {
        // split countries into the two halves of the globe they're on
        const [near, far] = partitionCountriesByHemisphere(countryNames)

        // keep the bigger half
        return near.length > far.length ? near : far
    }

    return visibleCountries
}

function partitionCountriesByHemisphere(
    countryNames: string[]
): [string[], string[]] {
    const features = excludeUndefined(
        countryNames.map((name) => geoFeaturesById.get(name))
    )

    // split into countries that are less and more than a quarter turn away
    // from the reference point, i.e. into the half of the globe centered on
    // the reference point and the opposite one
    const [near, far] = R.partition(
        features,
        (feature) =>
            geoDistance(feature.geoCentroid, HEMISPHERE_REFERENCE_POINT) <
            Math.PI / 2
    )

    return [near.map((feature) => feature.id), far.map((feature) => feature.id)]
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
