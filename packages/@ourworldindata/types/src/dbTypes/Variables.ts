import { OwidVariableType } from "../OwidVariable.js"
import { OwidVariableDisplayConfigInterface } from "../OwidVariableDisplayConfigInterface.js"
import { JsonString } from "../domainTypes/Various.js"

export const VariablesTableName = "variables"
export interface DbInsertVariable {
    attribution?: string | null
    attributionShort?: string | null
    catalogPath?: string | null
    code?: string | null
    columnOrder?: number
    coverage: string
    createdAt?: Date
    datasetId: number
    description?: string | null
    descriptionFromProducer?: string | null
    descriptionKey?: JsonString | null
    descriptionProcessing?: string | null
    descriptionShort?: string | null
    dimensions?: JsonString | null
    display: JsonString
    grapherConfigIdAdmin?: string | null
    grapherConfigIdETL?: string | null
    id?: number
    license?: JsonString | null
    licenses?: JsonString | null
    name?: string | null
    originalMetadata?: JsonString | null
    processingLevel?: string | null
    processingLog?: JsonString | null
    schemaVersion?: number
    shortName?: string | null
    shortUnit?: string | null
    sourceId?: number | null
    timespan: string
    titlePublic?: string | null
    titleVariant?: string | null
    unit: string
    updatedAt?: Date | null
    type?: OwidVariableType | null
    sort?: JsonString | null
    dataChecksum?: string | null
    metadataChecksum?: string | null
}

export type DbRawVariable = Required<DbInsertVariable>

export interface VariableDisplayDimension {
    originalShortName: string
    originalName: string
    filters: {
        name: string
        value: string
    }[]
}

export interface License {
    name: string
    url: string
}

export type DbEnrichedVariable = Omit<
    DbRawVariable,
    | "display"
    | "license"
    | "licenses"
    | "dimensions"
    | "descriptionKey"
    | "originalMetadata"
    | "processingLog"
    | "sort"
> & {
    display: OwidVariableDisplayConfigInterface
    license: License | null
    licenses: License[] | null
    dimensions: VariableDisplayDimension | null
    descriptionKey: string[] | null
    originalMetadata: unknown | null
    processingLog: unknown | null
    sort: string[] | null
}

export function parseVariableDisplayConfig(
    display: JsonString
): OwidVariableDisplayConfigInterface {
    return JSON.parse(display)
}

export function serializeVariableDisplayConfig(
    display: OwidVariableDisplayConfigInterface
): JsonString {
    return JSON.stringify(display)
}

export function parseVariableDimensions(
    dimensions: JsonString | null
): VariableDisplayDimension | null {
    return dimensions ? JSON.parse(dimensions) : null
}

export function serializeVariableDimensions(
    dimensions: VariableDisplayDimension | null
): JsonString | null {
    return dimensions ? JSON.stringify(dimensions) : null
}

export function parseVariableLicenses(
    licenses: JsonString | null
): License[] | null {
    return licenses ? JSON.parse(licenses) : null
}

export function serializeVariableLicenses(
    licenses: License[] | null
): JsonString | null {
    return licenses ? JSON.stringify(licenses) : null
}

export function parseLicense(license: JsonString | null): License | null {
    return license ? JSON.parse(license) : null
}

export function serializeLicense(license: License | null): JsonString | null {
    return license ? JSON.stringify(license) : null
}

export function parseVariableDescriptionKey(
    descriptionKey: JsonString | null
): string[] | null {
    return descriptionKey ? JSON.parse(descriptionKey) : null
}

export function serializeVariableDescriptionKey(
    descriptionKey: string[] | null
): JsonString | null {
    return descriptionKey ? JSON.stringify(descriptionKey) : null
}

export function parseVariableOriginalMetadata(
    originalMetadata: JsonString | null
): any {
    return originalMetadata ? JSON.parse(originalMetadata) : null
}

export function serializeVariableOriginalMetadata(
    originalMetadata: any
): JsonString | null {
    return originalMetadata ? JSON.stringify(originalMetadata) : null
}

export function parseVariableProcessingLog(
    processingLog: JsonString | null
): any {
    return processingLog ? JSON.parse(processingLog) : null
}

export function serializeVariableProcessingLog(
    processingLog: any
): JsonString | null {
    return processingLog ? JSON.stringify(processingLog) : null
}

export function parseVariableSort(sort: JsonString | null): string[] | null {
    return sort ? JSON.parse(sort) : null
}

export function serializeVariableSort(
    sort: string[] | null
): JsonString | null {
    return sort ? JSON.stringify(sort) : null
}

export function parseVariablesRow(row: DbRawVariable): DbEnrichedVariable {
    return {
        ...row,
        display: parseVariableDisplayConfig(row.display),
        license: row.license ? parseLicense(row.license) : null,
        licenses: parseVariableLicenses(row.licenses),
        dimensions: parseVariableDimensions(row.dimensions),
        descriptionKey: parseVariableDescriptionKey(row.descriptionKey),
        originalMetadata: parseVariableOriginalMetadata(row.originalMetadata),
        processingLog: parseVariableProcessingLog(row.processingLog),
        sort: parseVariableSort(row.sort),
    }
}

export function serializeVariablesRow(row: DbEnrichedVariable): DbRawVariable {
    return {
        ...row,
        display: serializeVariableDisplayConfig(row.display),
        license: row.license ? serializeLicense(row.license) : null,
        licenses: serializeVariableLicenses(row.licenses),
        dimensions: serializeVariableDimensions(row.dimensions),
        descriptionKey: serializeVariableDescriptionKey(row.descriptionKey),
        originalMetadata: serializeVariableOriginalMetadata(
            row.originalMetadata
        ),
        processingLog: serializeVariableProcessingLog(row.processingLog),
        sort: serializeVariableSort(row.sort),
    }
}
