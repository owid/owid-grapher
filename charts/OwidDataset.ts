import { VariableDisplaySettings } from "./Variable"
import * as lodash from "lodash"

interface OwidRow {
    entity: string
    value: number
    year: number
}

export interface TabularDataset {
    rows: OwidRow[]
}

export function tabularDataToOwidDataset(dataset: TabularDataset): OwidDataset {
    const { rows } = dataset
    const entityKey: { [id: string]: EntityMeta } = {}
    const entities = lodash.uniq(rows.map(row => row.entity))
    const entitiesByName: { [name: string]: number } = {}
    entities.forEach((entityName, index) => {
        entitiesByName[entityName] = index
        entityKey[index.toString()] = {
            id: index,
            name: entityName,
            code: ""
        }
    })
    return {
        variables: {
            "1": {
                years: rows.map(row => row.year),
                values: rows.map(row => row.value),
                entities: rows.map(row => entitiesByName[row.entity]),
                id: 1,
                name: "Dataset name",
                description: "Dataset description",
                shortUnit: "",
                datasetId: "1",
                datasetName: "World Bank",
                unit: "",
                display: {},
                source: {
                    id: 1,
                    name: "Source",
                    dataPublishedBy: "Publisher",
                    dataPublisherSource: "PublisherSource",
                    link: "",
                    retrievedDate: "",
                    additionalInfo: ""
                }
            }
        },
        entityKey
    }
}

export interface OwidDataset {
    variables: {
        [id: string]: {
            id: number
            name: string
            description: string
            unit: string
            shortUnit: string
            datasetName: string
            datasetId: string

            display: VariableDisplaySettings

            source: {
                id: number
                name: string
                dataPublishedBy: string
                dataPublisherSource: string
                link: string
                retrievedDate: string
                additionalInfo: string
            }

            years: number[]
            entities: number[]
            values: (number | string)[]
        }
    }
    entityKey: { [id: string]: EntityMeta }
}

export interface EntityMeta {
    id: number
    name: string
    code: string
}
