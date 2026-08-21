import { DatasetsTableName, VariablesTableName } from "@ourworldindata/types"
import type { TestEnv } from "./testEnv.js"

export const datasetId = 1
export const variableId = 1
export const otherVariableId = 2

/** Inserts the dataset and the two indicators that the admin API tests share */
export async function seedDatasetAndVariables(env: TestEnv): Promise<void> {
    await env.testKnex(DatasetsTableName).insert({
        id: datasetId,
        name: "Dummy dataset",
        description: "Dataset description",
        namespace: "owid",
        createdByUserId: env.userId,
        metadataEditedAt: new Date(),
        metadataEditedByUserId: env.userId,
        dataEditedAt: new Date(),
        dataEditedByUserId: env.userId,
    })

    const dummyVariable = {
        unit: "kg",
        coverage: "Global by country",
        timespan: "2000-2020",
        datasetId,
        display: '{ "unit": "kg", "shortUnit": "kg" }',
    }
    await env.testKnex(VariablesTableName).insert([
        { ...dummyVariable, id: variableId },
        { ...dummyVariable, id: otherVariableId },
    ])
}
