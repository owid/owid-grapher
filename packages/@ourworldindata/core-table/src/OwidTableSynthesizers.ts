import * as _ from "lodash-es"
import {
    sampleFrom,
    getRandomNumberGenerator,
    countries,
    OwidVariableDisplayConfigInterface,
    ColumnSlug,
} from "@ourworldindata/utils"
import {
    TimeRange,
    ColumnTypeNames,
    OwidColumnDef,
    OwidTableSlugs,
} from "@ourworldindata/types"
import { OwidTable } from "./OwidTable.js"

interface SynthOptions {
    entityCount: number
    entityNames: string[]
    timeRange: TimeRange
    columnDefs: OwidColumnDef[]
}

const SynthesizeOwidTable = (
    options?: Partial<SynthOptions>,
    seed = Date.now()
): OwidTable => {
    const finalOptions: SynthOptions = {
        entityNames: [],
        entityCount: 2,
        timeRange: [1950, 2020],
        columnDefs: [],
        ...options,
    }
    const { entityCount, columnDefs, timeRange, entityNames } = finalOptions
    const colSlugs = (
        [
            OwidTableSlugs.entityName,
            OwidTableSlugs.entityCode,
            OwidTableSlugs.entityId,
            OwidTableSlugs.year,
        ] as ColumnSlug[]
    ).concat(columnDefs.map((col) => col.slug!))

    const entities = entityNames.length
        ? entityNames.map((name) => {
              return {
                  name,
                  code: name.substr(0, 3).toUpperCase(),
              }
          })
        : sampleFrom(countries, entityCount, seed)

    const rows = entities.map((entity, index) => {
        let values = columnDefs.map((def) => def.generator!())
        return _.range(timeRange[0], timeRange[1])
            .map((year) => {
                values = columnDefs.map((def, index) =>
                    Math.round(
                        values[index] * (1 + def.growthRateGenerator!() / 100)
                    )
                )
                return [entity.name, entity.code, index, year, ...values].join(
                    ","
                )
            })
            .join("\n")
    })

    return new OwidTable(
        `${colSlugs.join(",")}\n${rows.join("\n")}`,
        columnDefs
    )
}

export const SynthesizeNonCountryTable = (
    options?: Partial<SynthOptions>,
    seed = Date.now()
): OwidTable =>
    SynthesizeOwidTable(
        {
            entityNames: ["Fire", "Earthquake", "Tornado"],
            columnDefs: [
                {
                    slug: SampleColumnSlugs.Disasters,
                    type: ColumnTypeNames.Integer,
                    generator: getRandomNumberGenerator(0, 20, seed),
                    growthRateGenerator: getRandomNumberGenerator(
                        -50,
                        50,
                        seed
                    ),
                },
            ],
            ...options,
        },
        seed
    )

export enum SampleColumnSlugs {
    Population = "Population",
    ProjectedPopulation = "ProjectedPopulation",
    GDP = "GDP",
    LifeExpectancy = "LifeExpectancy",
    Fruit = "Fruit",
    Vegetables = "Vegetables",
    Disasters = "Disasters",
}

export const SynthesizeGDPTable = (
    options?: Partial<SynthOptions>,
    seed = Date.now(),
    display?: OwidVariableDisplayConfigInterface
): OwidTable =>
    SynthesizeOwidTable(
        {
            columnDefs: [
                {
                    ...SynthSource(SampleColumnSlugs.Population),
                    slug: SampleColumnSlugs.Population,
                    type: ColumnTypeNames.Population,
                    generator: getRandomNumberGenerator(1e7, 1e9, seed),
                    growthRateGenerator: getRandomNumberGenerator(-5, 5, seed),
                    display,
                },
                {
                    ...SynthSource(SampleColumnSlugs.GDP),
                    slug: SampleColumnSlugs.GDP,
                    type: ColumnTypeNames.Currency,
                    generator: getRandomNumberGenerator(1e9, 1e12, seed),
                    growthRateGenerator: getRandomNumberGenerator(
                        -15,
                        15,
                        seed
                    ),
                    display,
                },
                {
                    ...SynthSource(SampleColumnSlugs.LifeExpectancy),
                    slug: SampleColumnSlugs.LifeExpectancy,
                    type: ColumnTypeNames.Age,
                    generator: getRandomNumberGenerator(60, 90, seed),
                    growthRateGenerator: getRandomNumberGenerator(-2, 2, seed),
                    display,
                },
            ],
            ...options,
        },
        seed
    )

const SynthSource = (
    name: string
): {
    sourceName: string
    sourceLink: string
    dataPublishedBy: string
    dataPublisherSource: string
    retrievedDate: string
    additionalInfo: string
} => {
    return {
        // id: name.charCodeAt(0) + name.charCodeAt(1) + name.charCodeAt(2),
        sourceName: `${name} Almanac`,
        sourceLink: "http://foo.example",
        dataPublishedBy: `${name} Synthetic Data Team`,
        dataPublisherSource: `${name} Institute`,
        retrievedDate: "1/1/2000",
        additionalInfo: `Downloaded via FTP`,
    }
}

export const SynthesizeFruitTable = (
    options?: Partial<SynthOptions>,
    seed = Date.now()
): OwidTable =>
    SynthesizeOwidTable(
        {
            columnDefs: [
                {
                    ...SynthSource(SampleColumnSlugs.Fruit),
                    slug: SampleColumnSlugs.Fruit,
                    type: ColumnTypeNames.Numeric,
                    generator: getRandomNumberGenerator(500, 1000, seed),
                    growthRateGenerator: getRandomNumberGenerator(
                        -10,
                        10,
                        seed
                    ),
                },
                {
                    ...SynthSource(SampleColumnSlugs.Vegetables),
                    slug: SampleColumnSlugs.Vegetables,
                    type: ColumnTypeNames.Numeric,
                    generator: getRandomNumberGenerator(400, 1000, seed),
                    growthRateGenerator: getRandomNumberGenerator(
                        -10,
                        12,
                        seed
                    ),
                },
            ],
            ...options,
        },
        seed
    )

export const SynthesizeFruitTableWithNonPositives = (
    options?: Partial<SynthOptions>,
    howManyNonPositives = 20,
    seed = Date.now()
): OwidTable => {
    const rand = getRandomNumberGenerator(-1000, 0)
    return SynthesizeFruitTable(options, seed).replaceRandomCells(
        howManyNonPositives,
        [SampleColumnSlugs.Fruit, SampleColumnSlugs.Vegetables],
        undefined,
        () => rand()
    )
}

const stringValues = ["NA", "inf", "..", "/", "-", "#VALUE!"]

export const SynthesizeFruitTableWithStringValues = (
    options?: Partial<SynthOptions>,
    howMany = 20,
    seed = Date.now()
): OwidTable => {
    return SynthesizeFruitTable(options, seed).replaceRandomCells(
        howMany,
        [SampleColumnSlugs.Fruit, SampleColumnSlugs.Vegetables],
        undefined,
        () => sampleFrom(stringValues, 1, Date.now())[0]
    )
}

export const SynthesizeProjectedPopulationTable = (
    options?: Partial<SynthOptions>,
    seed = Date.now(),
    display?: OwidVariableDisplayConfigInterface
): OwidTable =>
    SynthesizeOwidTable(
        {
            columnDefs: [
                {
                    ...SynthSource(SampleColumnSlugs.Population),
                    slug: SampleColumnSlugs.Population,
                    type: ColumnTypeNames.Population,
                    generator: getRandomNumberGenerator(1e7, 1e9, seed),
                    growthRateGenerator: getRandomNumberGenerator(-5, 5, seed),
                    display,
                },
                {
                    ...SynthSource(SampleColumnSlugs.ProjectedPopulation),
                    slug: SampleColumnSlugs.ProjectedPopulation,
                    type: ColumnTypeNames.Population,
                    generator: getRandomNumberGenerator(1e9, 1e12, seed),
                    growthRateGenerator: getRandomNumberGenerator(
                        -15,
                        15,
                        seed
                    ),
                    display: {
                        ...display,
                        isProjection: true,
                    },
                },
            ],
            ...options,
        },
        seed
    )
