import {
    ColumnTypeNames,
    OwidColumnDef,
    OwidVariableDimensions,
} from "@ourworldindata/types"
import {
    OwidVariableType,
    OwidVariableWithSourceAndDimension,
} from "@ourworldindata/utils"
import { isContinentsVariableId } from "./GrapherConstants"
import { parseIndicatorAnnotations } from "./parseIndicatorAnnotations.js"

const variableTypeToColumnType = (type: OwidVariableType): ColumnTypeNames => {
    switch (type) {
        case "ordinal":
            return ColumnTypeNames.Ordinal
        case "string":
            return ColumnTypeNames.String
        case "int":
            return ColumnTypeNames.Integer
        case "float":
            return ColumnTypeNames.Numeric
        case "mixed":
        default:
            return ColumnTypeNames.NumberOrString
    }
}

/** The sort order of an ordinal variable's categories, e.g. Low, Medium, High */
const getSortFromDimensions = (
    dimensions: OwidVariableDimensions
): string[] | undefined => {
    const sort = dimensions.values?.values
        ?.map((value) => value.name)
        .filter((name) => name !== undefined)
    return sort?.length ? sort : undefined
}

/** Builds a base OwidColumnDef from an indicator's metadata */
export const columnDefFromOwidVariable = (
    variable: OwidVariableWithSourceAndDimension
): OwidColumnDef => {
    const { source, display } = variable
    const parsedType = variable.type
        ? variableTypeToColumnType(variable.type)
        : ColumnTypeNames.NumberOrString

    return {
        name: variable.name,
        slug: variable.id.toString(),
        unit: variable.unit,
        shortUnit: variable.shortUnit,
        description: variable.description,
        descriptionShort: variable.descriptionShort,
        descriptionProcessing: variable.descriptionProcessing,
        descriptionKey: variable.descriptionKey,
        descriptionFromProducer: variable.descriptionFromProducer,
        coverage: variable.coverage,
        datasetId: variable.datasetId,
        datasetName: variable.datasetName,
        display,
        color: display?.color,
        nonRedistributable: variable.nonRedistributable,
        sourceLink: source?.link,
        sourceName: source?.name,
        dataPublishedBy: source?.dataPublishedBy,
        dataPublisherSource: source?.dataPublisherSource,
        retrievedDate: source?.retrievedDate,
        additionalInfo: source?.additionalInfo,
        timespan: variable.timespan,
        origins: variable.origins,
        annotations: parseIndicatorAnnotations(variable),
        presentation: variable.presentation,
        catalogPath: variable.catalogPath,
        updatePeriodDays: variable.updatePeriodDays,
        owidVariableId: variable.id,
        owidProcessingLevel: variable.processingLevel,
        owidSchemaVersion: variable.schemaVersion,
        // The Continents variable gets its own column type
        type: isContinentsVariableId(variable.id)
            ? ColumnTypeNames.Continent
            : parsedType,
        sort:
            parsedType === ColumnTypeNames.Ordinal
                ? getSortFromDimensions(variable.dimensions)
                : undefined,
        shortName: variable.shortName,
    }
}
