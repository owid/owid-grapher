export { CoreTable, columnDefinitionsFromInput } from "./CoreTable.js"
export {
    SynthesizeNonCountryTable,
    SampleColumnSlugs,
    SynthesizeGDPTable,
    SynthesizeFruitTable,
    SynthesizeFruitTableWithNonPositives,
    SynthesizeFruitTableWithStringValues,
} from "./OwidTableSynthesizers.js"

export {
    type CoreColumn,
    MissingColumn,
    ColumnTypeMap,
    AbstractCoreColumn,
    TimeColumn,
} from "./CoreTableColumns.js"

export { OwidTable, BlankOwidTable } from "./OwidTable.js"

export {
    DroppedForTesting,
    DivideByZeroError,
    ValueTooLow,
    MissingValuePlaceholder,
    ErrorValueTypes,
    isNotErrorValue,
    isNotErrorValueOrEmptyCell,
    defaultIfErrorValue,
} from "./ErrorValues.js"

export {
    columnStoreToRows,
    truncate,
    makeAutoTypeFn,
    standardizeSlugs,
    guessColumnDefFromSlugAndRow,
    makeRowFromColumnStore,
    type InterpolationContext,
    type LinearInterpolationContext,
    type ToleranceInterpolationContext,
    type InterpolationProvider,
    linearInterpolation,
    toleranceInterpolation,
    interpolateRowValuesWithTolerance,
    makeKeyFn,
    concatColumnStores,
    rowsToColumnStore,
    autodetectColumnDefs,
    replaceDef,
    reverseColumnStore,
    renameColumnStore,
    getDropIndexes,
    replaceRandomCellsInColumnStore,
    Timer,
    rowsFromMatrix,
    trimMatrix,
    matrixToDelimited,
    parseDelimited,
    detectDelimiter,
    rowsToMatrix,
    isCellEmpty,
    trimEmptyRows,
    trimArray,
    sortColumnStore,
    emptyColumnsInFirstRowInDelimited,
} from "./CoreTableUtils.js"

export {
    timeColumnSlugFromColumnDef,
    makeOriginalTimeSlugFromColumnSlug,
    getOriginalTimeColumnSlug,
    toPercentageColumnDef,
} from "./OwidTableUtil.js"

export {
    insertMissingValuePlaceholders,
    computeRollingAverage,
    AvailableTransforms,
    applyTransforms,
    extractPotentialDataSlugsFromTransform,
} from "./Transforms.js"
