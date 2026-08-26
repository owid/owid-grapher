import { useEffect, useMemo, useRef } from "react"
import * as _ from "lodash-es"
import {
    ContinentColors,
    MapContinentColors,
    Grapher,
    GrapherState,
    getRegionsForKey,
    regionGroupLabels,
    useElementBounds,
    type TooltipKey,
} from "@ourworldindata/grapher"
import { getRegionSets } from "@ourworldindata/utils"
import { OwidTable } from "@ourworldindata/core-table"
import {
    ColorSchemeName,
    ColumnTypeNames,
    EntitySelectionMode,
    GRAPHER_CHART_TYPES,
    GRAPHER_TAB_CONFIG_OPTIONS,
} from "@ourworldindata/types"
import { regionSetLabels } from "./EntityPresets.js"
import { AdminLayout } from "./AdminLayout.js"

const REGION_COLUMN_SLUG = "region"
const VALUE_COLUMN_SLUG = "value"

// The synthesized tables need some year; its value doesn't matter since the
// timeline is hidden
const SYNTHETIC_YEAR = 2025

// Year range of the fake data on the line charts
const LINE_CHART_START_YEAR = 2000
const LINE_CHART_END_YEAR = 2025

// One map per region set defined in the regions data,
// plus the two OWID groupings
const REGION_MAP_KEYS: TooltipKey[] = [
    "continents",
    "incomeGroups",
    ...[...getRegionSets()].sort(),
]

function synthesizeRegionMapTable(key: TooltipKey): OwidTable {
    // Regions come sorted in their geographic display order
    const regions = getRegionsForKey(key)

    const rows = regions.flatMap((region) =>
        region.members.map((country) => ({
            entityName: country,
            year: SYNTHETIC_YEAR,
            [REGION_COLUMN_SLUG]: region.name,
        }))
    )

    return new OwidTable(rows, [
        {
            slug: REGION_COLUMN_SLUG,
            type: ColumnTypeNames.Ordinal,
            name: "World region",
            // Order the map legend geographically
            sort: regions.map((region) => region.name),
        },
        { slug: "year", type: ColumnTypeNames.Year },
    ])
}

// One line per region, with fake data: parallel lines whose top-to-bottom
// order matches the geographic order of the map legend
function synthesizeRegionLineChartTable(key: TooltipKey): OwidTable {
    const regions = getRegionsForKey(key)

    const rows = regions.flatMap((region, index) =>
        _.range(LINE_CHART_START_YEAR, LINE_CHART_END_YEAR + 1).map((year) => ({
            entityName: region.name,
            year,
            [VALUE_COLUMN_SLUG]:
                (regions.length - index) * 10 + (year - LINE_CHART_START_YEAR),
        }))
    )

    return new OwidTable(rows, [
        {
            slug: VALUE_COLUMN_SLUG,
            type: ColumnTypeNames.Numeric,
            name: "Synthetic data",
        },
        { slug: "year", type: ColumnTypeNames.Year },
    ])
}

function makeRegionMapTitle(key: TooltipKey): string {
    return key === "continents" || key === "incomeGroups"
        ? regionGroupLabels[key]
        : regionSetLabels[key]
}

function makeRegionMapGrapherState(key: TooltipKey): GrapherState {
    const grapherState = new GrapherState({
        title: makeRegionMapTitle(key),
        chartTypes: [],
        hasMapTab: true,
        tab: GRAPHER_TAB_CONFIG_OPTIONS.map,
        map: {
            hideTimeline: true,
            colorScale: {
                baseColorScheme: ColorSchemeName.OwidCategoricalMap,
            },
        },
        table: synthesizeRegionMapTable(key),
    })
    grapherState.ySlugs = REGION_COLUMN_SLUG
    return grapherState
}

function makeRegionLineChartGrapherState(key: TooltipKey): GrapherState {
    const grapherState = new GrapherState({
        title: makeRegionMapTitle(key),
        chartTypes: [GRAPHER_CHART_TYPES.LineChart],
        tab: GRAPHER_TAB_CONFIG_OPTIONS.chart,
        baseColorScheme: ColorSchemeName.continents,
        addCountryMode: EntitySelectionMode.Disabled,
        selectedEntityNames: getRegionsForKey(key).map((region) => region.name),
        table: synthesizeRegionLineChartTable(key),
    })
    grapherState.ySlugs = VALUE_COLUMN_SLUG
    return grapherState
}

// Whether every region of the set has a hard-coded color
function hasHardCodedColors(key: TooltipKey): boolean {
    return getRegionsForKey(key).every(
        (region) =>
            region.name in ContinentColors && region.name in MapContinentColors
    )
}

// Grapher renders at fixed default bounds unless given external bounds, so
// measure the figure and resize the chart with it (like GrapherFigureView)
function RegionMapFigure({ grapherState }: { grapherState: GrapherState }) {
    const base = useRef<HTMLDivElement>(null)
    const bounds = useElementBounds(base, null)
    useEffect(() => {
        if (bounds) grapherState.externalBounds = bounds
    }, [bounds, grapherState])
    return (
        <figure ref={base}>
            {bounds && <Grapher grapherState={grapherState} />}
        </figure>
    )
}

export function TestRegionMapsPage() {
    const sections = useMemo(() => {
        const [pinnedKeys, unpinnedKeys] = _.partition(
            REGION_MAP_KEYS,
            hasHardCodedColors
        )
        const makeStates = (key: TooltipKey) => ({
            key,
            mapGrapherState: makeRegionMapGrapherState(key),
            lineChartGrapherState: makeRegionLineChartGrapherState(key),
        })
        return [
            {
                heading: "Region sets with hard-coded colors",
                regionMaps: pinnedKeys.map(makeStates),
            },
            {
                heading: "Region sets without hard-coded colors",
                regionMaps: unpinnedKeys.map(makeStates),
            },
        ]
    }, [])
    return (
        <AdminLayout title="Region maps">
            <main className="TestRegionMapsPage">
                {sections.map(({ heading, regionMaps }) => (
                    <section key={heading}>
                        <h2>{heading}</h2>
                        {regionMaps.map(
                            ({
                                key,
                                mapGrapherState,
                                lineChartGrapherState,
                            }) => (
                                <div
                                    key={key}
                                    className="TestRegionMapsPage__row"
                                >
                                    <RegionMapFigure
                                        grapherState={mapGrapherState}
                                    />
                                    <RegionMapFigure
                                        grapherState={lineChartGrapherState}
                                    />
                                </div>
                            )
                        )}
                    </section>
                ))}
            </main>
        </AdminLayout>
    )
}
