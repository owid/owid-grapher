import {
    ColumnTypeNames,
    CoreColumnSpec,
    CoreRow,
    EntityCode,
    EntityId,
    EntityName,
    Integer,
    Time,
    Year,
} from "./CoreTableConstants"
import { LegacyVariableId, OwidSource } from "./LegacyVariableCode"

export enum OwidTableSlugs {
    entityName = "entityName",
    entityColor = "entityColor",
    entityId = "entityId",
    entityCode = "entityCode",
    time = "time",
    day = "day",
    year = "year",
}

export interface OwidColumnSpec extends CoreColumnSpec {
    owidVariableId?: LegacyVariableId
    coverage?: string
    datasetId?: string
    datasetName?: string
    source?: OwidSource
    isDailyMeasurement?: boolean // todo: remove
}

export const RequiredColumnSpecs: OwidColumnSpec[] = [
    {
        name: "Entity",
        slug: OwidTableSlugs.entityName,
        type: ColumnTypeNames.Categorical,
    },
    {
        slug: OwidTableSlugs.entityId,
        type: ColumnTypeNames.Categorical,
    },
    {
        name: "Code",
        slug: OwidTableSlugs.entityCode,
        type: ColumnTypeNames.Categorical,
    },
]

// This is a row with the additional columns specific to our OWID data model
// todo: don't export?
export interface OwidRow extends CoreRow {
    entityName: EntityName
    entityCode: EntityCode
    entityId: EntityId
    time: Time
    year?: Year
    day?: Integer
    date?: string
}
