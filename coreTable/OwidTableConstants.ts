import {
    ColumnSlug,
    ColumnTypeNames,
    CoreColumnDef,
    CoreRow,
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

export type EntityName = string
export type EntityCode = string
export type EntityId = number

// Todo: coverage, datasetId, and datasetName can just be on source, right? or should we flatten source onto this?
export interface OwidColumnDef extends CoreColumnDef {
    owidVariableId?: LegacyVariableId // todo: remove after data 2.0
    coverage?: string
    datasetId?: string
    datasetName?: string
    source?: OwidSource
    isDailyMeasurement?: boolean // todo: remove after mysql time refactor
    annotationsColumnSlug?: ColumnSlug
}

export const OwidEntityNameColumnDef = {
    name: OwidTableNames.Entity,
    slug: OwidTableSlugs.entityName,
    type: ColumnTypeNames.EntityName,
}

export const OwidEntityIdColumnDef = {
    slug: OwidTableSlugs.entityId,
    type: ColumnTypeNames.EntityId,
}

export const OwidEntityCodeColumnDef = {
    name: OwidTableNames.Code,
    slug: OwidTableSlugs.entityCode,
    type: ColumnTypeNames.EntityCode,
}

export const StandardOwidColumnDefs: OwidColumnDef[] = [
    OwidEntityNameColumnDef,
    OwidEntityIdColumnDef,
    OwidEntityCodeColumnDef,
]

// This is a row with the additional columns specific to our OWID data model
export interface OwidRow extends CoreRow {
    entityName: EntityName
    time: Time
    entityCode?: EntityCode
    entityId?: EntityId
    year?: Year
    day?: Integer
    date?: string
}
