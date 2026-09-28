/**
 * The synthetic data the admin browser tests run against: a handful of
 * entities and indicators with deterministic values.
 *
 * Each indicator is defined once here. `server.ts` turns the
 * definitions into database rows (for the editor's indicator picker and
 * the admin API) and into the `{id}.data.json` / `{id}.metadata.json` files
 * the data API would normally serve, so both views of an indicator always
 * agree.
 *
 * Every indicator has at most ten entities, which keeps the editor's default
 * entity selection deterministic: with ten or fewer available entities it
 * selects all of them instead of sampling.
 */
import type {
    GrapherInterface,
    OwidVariableDisplayConfigInterface,
    OwidVariableMixedData,
    OwidVariableType,
    OwidVariableWithSourceAndDimension,
} from "@ourworldindata/types"

export interface FixtureEntity {
    id: number
    name: string
    code: string
}

// Real entity ids and codes, so that the map tab can place the countries
export const entities = {
    world: { id: 355, name: "World", code: "OWID_WRL" },
    france: { id: 3, name: "France", code: "FRA" },
    germany: { id: 6, name: "Germany", code: "DEU" },
    kenya: { id: 129, name: "Kenya", code: "KEN" },
    nigeria: { id: 103, name: "Nigeria", code: "NGA" },
    india: { id: 137, name: "India", code: "IND" },
    japan: { id: 14, name: "Japan", code: "JPN" },
    brazil: { id: 37, name: "Brazil", code: "BRA" },
} as const satisfies Record<string, FixtureEntity>

const countries: FixtureEntity[] = [
    entities.france,
    entities.germany,
    entities.kenya,
    entities.nigeria,
    entities.india,
    entities.japan,
    entities.brazil,
]
const countriesAndWorld: FixtureEntity[] = [entities.world, ...countries]

export const FIRST_YEAR = 2000
export const LAST_YEAR = 2020

export interface FixtureDataset {
    id: number
    name: string
    namespace: string
}

export const datasets = {
    health: { id: 1, name: "Synthetic health data", namespace: "test_health" },
    economy: {
        id: 2,
        name: "Synthetic economic data",
        namespace: "test_economy",
    },
    energy: { id: 3, name: "Synthetic energy data", namespace: "test_energy" },
    regions: { id: 4, name: "Regions", namespace: "regions" },
} as const satisfies Record<string, FixtureDataset>

export interface FixtureIndicator {
    id: number
    name: string
    unit: string
    shortUnit?: string
    display?: OwidVariableDisplayConfigInterface
    descriptionShort?: string
    type: OwidVariableType
    dataset: FixtureDataset
    catalogPath: string
    entities: FixtureEntity[]
    /** Value for an entity in a year; undefined means no data point */
    value: (
        entity: FixtureEntity,
        entityIndex: number,
        year: number
    ) => number | string | undefined
    /** The indicator's ETL-authored grapher config that charts inherit */
    grapherConfigETL?: GrapherInterface
}

const linear =
    (base: number, perEntity: number, perYear: number) =>
    (_entity: FixtureEntity, entityIndex: number, year: number): number =>
        base + entityIndex * perEntity + (year - FIRST_YEAR) * perYear

export const indicators = {
    lifeExpectancy: {
        id: 1001,
        name: "Life expectancy",
        unit: "years",
        shortUnit: "",
        descriptionShort: "The average number of years a newborn would live.",
        type: "float",
        dataset: datasets.health,
        catalogPath: "grapher/test/2024-01-01/health/health#life_expectancy",
        entities: countriesAndWorld,
        value: linear(60, 2, 0.3),
    },
    childMortality: {
        id: 1002,
        name: "Child mortality rate",
        unit: "%",
        shortUnit: "%",
        type: "float",
        dataset: datasets.health,
        catalogPath: "grapher/test/2024-01-01/health/health#child_mortality",
        entities: countriesAndWorld,
        value: linear(10, 0.5, -0.2),
        grapherConfigETL: {
            title: "Child mortality rate (inherited title)",
            subtitle: "Share of children who die before age five.",
            note: "Inherited note from the indicator.",
            hasMapTab: true,
        },
    },
    gdpPerCapita: {
        id: 1003,
        name: "GDP per capita",
        unit: "international-$ in 2021 prices",
        shortUnit: "$",
        type: "float",
        dataset: datasets.economy,
        // matches GDP_PER_CAPITA_CATALOG_PATH, the default scatter x-axis
        catalogPath: "grapher/worldbank_wdi/2025-01-01/wdi/wdi#ny_gdp_pcap_pp_kd",
        entities: countriesAndWorld,
        value: linear(2000, 3000, 250),
    },
    population: {
        id: 1004,
        name: "Population",
        unit: "people",
        shortUnit: "",
        type: "int",
        dataset: datasets.economy,
        // matches POPULATION_CATALOG_PATH, the default scatter size
        catalogPath:
            "grapher/demography/2024-07-15/population/population#population",
        entities: countriesAndWorld,
        value: (entity, entityIndex, year) =>
            entity === entities.world
                ? 6_000_000_000 + (year - FIRST_YEAR) * 80_000_000
                : 50_000_000 + entityIndex * 20_000_000 + (year - FIRST_YEAR),
    },
    gdpGrowth: {
        id: 1005,
        name: "GDP growth",
        unit: "%",
        shortUnit: "%",
        type: "float",
        dataset: datasets.economy,
        catalogPath: "grapher/test/2024-01-01/economy/economy#gdp_growth",
        entities: countriesAndWorld,
        // alternates between positive and negative values
        value: (_entity, entityIndex, year) =>
            ((entityIndex + year) % 5) - 2,
    },
    coalEmissions: {
        id: 1006,
        name: "CO2 emissions from coal",
        unit: "tonnes",
        shortUnit: "t",
        type: "float",
        dataset: datasets.energy,
        catalogPath: "grapher/test/2024-01-01/energy/energy#coal",
        entities: countries,
        value: linear(100, 10, 2),
    },
    oilEmissions: {
        id: 1007,
        name: "CO2 emissions from oil",
        unit: "tonnes",
        shortUnit: "t",
        type: "float",
        dataset: datasets.energy,
        catalogPath: "grapher/test/2024-01-01/energy/energy#oil",
        entities: countries,
        value: linear(80, 5, 1),
    },
    gasEmissions: {
        id: 1008,
        name: "CO2 emissions from gas",
        unit: "tonnes",
        shortUnit: "t",
        type: "float",
        dataset: datasets.energy,
        catalogPath: "grapher/test/2024-01-01/energy/energy#gas",
        entities: countries,
        // Kenya has no gas data before 2010, for missing-data handling
        value: (entity, entityIndex, year) =>
            entity === entities.kenya && year < 2010
                ? undefined
                : 50 + entityIndex * 3 + (year - FIRST_YEAR),
    },
    continents: {
        // CONTINENTS_INDICATOR_ID, the default scatter color
        id: 900801,
        name: "World region according to OWID",
        unit: "",
        type: "ordinal",
        dataset: datasets.regions,
        catalogPath: "grapher/regions/2023-01-01/regions/regions#owid_region",
        entities: countries,
        value: (entity) => continentByCountry[entity.name],
    },
} as const satisfies Record<string, FixtureIndicator>

const continentByCountry: Record<string, string> = {
    France: "Europe",
    Germany: "Europe",
    Kenya: "Africa",
    Nigeria: "Africa",
    India: "Asia",
    Japan: "Asia",
    Brazil: "South America",
}

export const tags = [
    { id: 1, name: "Health", slug: "health" },
    { id: 2, name: "Energy", slug: "energy" },
    { id: 3, name: "Economic Growth", slug: "economic-growth" },
]

/** A detail on demand that text fields can reference as `#dod:life_expectancy` */
export const dods = [
    {
        id: 1,
        name: "life_expectancy",
        content: "The average number of years a newborn would live.",
    },
]

export const allIndicators: FixtureIndicator[] = Object.values(indicators)

const years = (): number[] =>
    Array.from(
        { length: LAST_YEAR - FIRST_YEAR + 1 },
        (_, i) => FIRST_YEAR + i
    )

/** The indicator's values in the shape of the data API's `{id}.data.json` */
export function indicatorData(
    indicator: FixtureIndicator
): OwidVariableMixedData {
    const data: OwidVariableMixedData = { values: [], years: [], entities: [] }
    const indicatorYears =
        indicator.type === "ordinal" ? [LAST_YEAR] : years()
    indicator.entities.forEach((entity, entityIndex) => {
        for (const year of indicatorYears) {
            const value = indicator.value(entity, entityIndex, year)
            if (value === undefined) continue
            data.values.push(value)
            data.years.push(year)
            data.entities.push(entity.id)
        }
    })
    return data
}

/** The indicator's metadata in the shape of the data API's `{id}.metadata.json` */
export function indicatorMetadata(
    indicator: FixtureIndicator
): OwidVariableWithSourceAndDimension {
    const data = indicatorData(indicator)
    const categories =
        indicator.type === "ordinal"
            ? [...new Set(data.values.map(String))]
            : undefined
    return {
        id: indicator.id,
        name: indicator.name,
        unit: indicator.unit,
        shortUnit: indicator.shortUnit,
        descriptionShort: indicator.descriptionShort,
        display: indicator.display ?? {},
        type: indicator.type,
        datasetId: indicator.dataset.id,
        datasetName: indicator.dataset.name,
        catalogPath: indicator.catalogPath,
        schemaVersion: 2,
        dimensions: {
            years: {
                values: [...new Set(data.years)].map((id) => ({ id })),
            },
            entities: {
                values: indicator.entities.map(({ id, name, code }) => ({
                    id,
                    name,
                    code,
                })),
            },
            ...(categories && {
                values: {
                    values: categories.map((name, id) => ({ id, name })),
                },
            }),
        },
        origins: [
            {
                id: indicator.dataset.id,
                title: indicator.dataset.name,
                producer: "Our World in Data test fixtures",
            },
        ],
    }
}
