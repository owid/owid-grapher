import { Region, regions, uniqBy } from "@ourworldindata/utils"
import {
    MultipleOwidVariableDataDimensionsMap,
    OwidVariableWithSource,
    EntityCode,
    EntityId,
    EntityName,
} from "@ourworldindata/types"

type Entity = { id: EntityId; code?: EntityCode; name?: EntityName }
type TestDatum = { year: number; entity: Entity; value: string | number }

export type TestData = TestDatum[]
export type TestMetadata = OwidVariableWithSource

const fakeRegions = regions.map((region: Region, index: number) => ({
    ...region,
    id: index + 1,
}))

export const fakeEntities = Object.fromEntries(
    fakeRegions.map((entity: Region & { id: number }) => [
        entity.name,
        { id: entity.id, code: entity.code, name: entity.name },
    ])
)

export function createOwidTestDataset(
    indicators: {
        data: TestData
        metadata: TestMetadata
    }[]
): MultipleOwidVariableDataDimensionsMap {
    return new Map(
        indicators.map(({ data, metadata }) => [
            metadata.id,
            {
                data: {
                    years: data.map((d) => d.year),
                    entities: data.map((d) => d.entity.id),
                    values: data.map((d) => d.value),
                },
                metadata: {
                    ...metadata,
                    dimensions: {
                        entities: {
                            values: uniqBy(
                                data.map((d) => d.entity),
                                "id"
                            ),
                        },
                        years: {
                            values: uniqBy(
                                data.map((d) => ({ id: d.year })),
                                "id"
                            ),
                        },
                    },
                },
            },
        ])
    )
}
