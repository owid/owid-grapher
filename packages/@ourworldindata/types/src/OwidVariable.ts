import { OwidOrigin } from "./OwidOrigin.js"
import { OwidSource } from "./OwidSource.js"
import { OwidVariableDisplayConfigInterface } from "./OwidVariableDisplayConfigInterface.js"

/**
 * Convert a legacy descriptionKey array into a single markdown string.
 *
 * descriptionKey used to be an array of bullet points and is now free-form
 * markdown. Persisted metadata (indicator metadata JSON files on R2, database
 * rows and multi-dim configs written before the migration) may still carry
 * arrays, so every ingress point normalizes through this function.
 *
 * The conversion preserves the legacy rendering exactly: a single entry was
 * rendered as prose, multiple entries as a bulleted list.
 */
export function normalizeDescriptionKey(
    value: string | string[] | undefined | null
): string | undefined {
    if (value === undefined || value === null) return undefined
    if (typeof value === "string") return value.trim() || undefined
    const items = value.map((item) => item.trim()).filter((item) => item)
    if (items.length === 0) return undefined
    if (items.length === 1) return items[0]
    // Indent continuation lines so multi-line items stay inside their bullet.
    return items.map((item) => `- ${item.replaceAll("\n", "\n  ")}`).join("\n")
}

export interface OwidVariableWithSource {
    id: number
    name?: string
    description?: string
    descriptionShort?: string
    descriptionFromProducer?: string
    descriptionKey?: string
    descriptionProcessing?: string
    unit?: string
    display?: OwidVariableDisplayConfigInterface
    shortUnit?: string
    datasetName?: string
    datasetId?: number
    coverage?: string
    nonRedistributable?: boolean
    source?: OwidSource
    origins?: OwidOrigin[]
    schemaVersion?: number
    processingLevel?: OwidProcessingLevel
    presentation?: OwidVariablePresentation
    shortName?: string
    timespan?: string
    catalogPath?: string
    license?: OwidLicense
    updatePeriodDays?: number
    datasetVersion?: string
    licenses?: OwidLicense[]
    type?: OwidVariableType

    // omitted:
    // code
    // coverage
    // dataPath
    // metadataPath
}

export interface IndicatorTitleWithFragments {
    title: string
    attributionShort?: string
    titleVariant?: string
}

export function joinTitleFragments(
    attributionShort: string | undefined,
    titleVariant: string | undefined
): string | undefined {
    if (attributionShort && titleVariant && attributionShort !== titleVariant) {
        return `${titleVariant} – ${attributionShort}`
    }
    if (attributionShort) {
        return attributionShort
    }
    if (titleVariant) {
        return titleVariant
    }
    return undefined
}

export interface OwidLicense {
    name: string
    url: string
}

export interface OwidVariablePresentation {
    titlePublic?: string
    titleVariant?: string
    attributionShort?: string
    attribution?: string
    topicTagsLinks?: string[]
    faqs?: FaqLink[]
}

export type OwidProcessingLevel = "minor" | "major"

export interface FaqLink {
    gdocId: string
    fragmentId: string
}

export type OwidVariableWithSourceAndDimension = OwidVariableWithSource & {
    dimensions: OwidVariableDimensions
}

export type OwidVariableWithSourceAndDimensionWithoutId = Omit<
    OwidVariableWithSourceAndDimension,
    "id"
>

export interface OwidVariableMixedData {
    years: number[]
    entities: number[]
    values: (string | number)[]
}

export type OwidVariableWithDataAndSource = OwidVariableWithSource &
    OwidVariableMixedData

export interface OwidVariableDimension {
    values: OwidVariableDimensionValuePartial[]
}

export interface OwidVariableDimensions {
    years: OwidVariableDimension
    entities: OwidVariableDimension
    values?: OwidVariableDimension
}

export type OwidVariableDataMetadataDimensions = {
    data: OwidVariableMixedData
    metadata: OwidVariableWithSourceAndDimension
}
export type MultipleOwidVariableDataDimensionsMap = Map<
    number,
    OwidVariableDataMetadataDimensions
>

export interface OwidVariableDimensionValuePartial {
    id: number
    name?: string
    code?: string
}
export type OwidVariableDimensionValueFull =
    Required<OwidVariableDimensionValuePartial>

export interface OwidEntityKey {
    [id: string]: OwidVariableDimensionValuePartial
}

export type OwidVariableType = "string" | "float" | "int" | "mixed" | "ordinal"
