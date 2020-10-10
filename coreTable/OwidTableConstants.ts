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

enum OwidTableNames {
    Entity = "Entity",
    Code = "Code",
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
        name: OwidTableNames.Entity,
        slug: OwidTableSlugs.entityName,
        type: ColumnTypeNames.EntityName,
    },
    {
        slug: OwidTableSlugs.entityId,
        type: ColumnTypeNames.EntityId,
    },
    {
        name: OwidTableNames.Code,
        slug: OwidTableSlugs.entityCode,
        type: ColumnTypeNames.EntityCode,
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
