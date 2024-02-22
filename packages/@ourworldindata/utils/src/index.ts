export {
    pairs,
    type NoUndefinedValues,
    type AllKeysRequired,
    type PartialBy,
    createFormatter,
    getRelativeMouse,
    exposeInstanceOnWindow,
    makeSafeForCSS,
    formatDay,
    formatYear,
    numberMagnitude,
    roundSigFig,
    first,
    last,
    excludeNull,
    excludeNullish,
    excludeUndefined,
    firstOfNonEmptyArray,
    lastOfNonEmptyArray,
    mapToObjectLiteral,
    next,
    previous,
    domainExtent,
    cagr,
    makeAnnotationsSlug,
    slugify,
    slugifySameCase,
    guid,
    TESTING_ONLY_reset_guid,
    pointsToPath,
    sortedFindClosestIndex,
    sortedFindClosest,
    isMobile,
    isTouchDevice,
    type Json,
    csvEscape,
    urlToSlug,
    trimObject,
    fetchText,
    getUserCountryInformation,
    stripHTML,
    getRandomNumberGenerator,
    sampleFrom,
    getIdealGridParams,
    findClosestTimeIndex,
    findClosestTime,
    es6mapValues,
    type DataValue,
    valuesByEntityAtTimes,
    valuesByEntityWithinTimes,
    getStartEndValues,
    dateDiffInDays,
    diffDateISOStringInDays,
    getYearFromISOStringAndDayOffset,
    addDays,
    parseIntOrUndefined,
    anyToString,
    scrollIntoViewIfNeeded,
    rollingMap,
    groupMap,
    keyMap,
    oneOf,
    intersectionOfSets,
    unionOfSets,
    differenceOfSets,
    isSubsetOf,
    intersection,
    sortByUndefinedLast,
    mapNullToUndefined,
    lowerCaseFirstLetterUnlessAbbreviation,
    sortNumeric,
    mapBy,
    findIndexFast,
    logMe,
    getClosestTimePairs,
    omitUndefinedValues,
    omitNullableValues,
    isInIFrame,
    differenceObj,
    findDOMParent,
    wrapInDiv,
    textAnchorFromAlign,
    dyFromAlign,
    values,
    stringifyUnknownError,
    toRectangularMatrix,
    checkIsPlainObjectWithGuard,
    checkIsStringIndexable,
    triggerDownloadFromBlob,
    triggerDownloadFromUrl,
    removeAllWhitespace,
    moveArrayItemToIndex,
    getIndexableKeys,
    retryPromise,
    getOwidGdocFromJSON,
    formatDate,
    canWriteToClipboard,
    isNegativeInfinity,
    isPositiveInfinity,
    imemo,
    recursivelyMapArticleContent,
    traverseEnrichedBlocks,
    checkNodeIsSpan,
    checkNodeIsSpanLink,
    spansToUnformattedPlainText,
    findDuplicates,
    checkIsOwidGdocType,
    isArrayOfNumbers,
    greatestCommonDivisor,
    findGreatestCommonDivisorOfArray,
    type NodeWithUrl,
    filterValidStringValues,
    traverseEnrichedSpan,
    mergePartialGrapherConfigs,
    copyToClipboard,
    checkIsGdocPost,
    checkIsDataInsight,
    cartesian,
} from "./Util.js"

export {
    getOriginAttributionFragments,
    getAttributionFragmentsFromVariable,
    getETLPathComponents,
    formatAuthors,
    getLastUpdatedFromVariable,
    getNextUpdateFromVariable,
    getPhraseForProcessingLevel,
    splitSourceTextIntoFragments,
    prepareSourcesForDisplay,
    formatSourceDate,
    getCitationLong,
    getCitationShort,
    grabMetadataForGdocLinkedIndicator,
} from "./metadataHelpers.js"

export {
    capitalize,
    chunk,
    clone,
    cloneDeep,
    compact,
    countBy,
    debounce,
    difference,
    drop,
    dropRightWhile,
    dropWhile,
    extend,
    findLastIndex,
    flatten,
    get,
    groupBy,
    identity,
    invert,
    isArray,
    isBoolean,
    isEmpty,
    isEqual,
    isNil,
    isNull,
    isNumber,
    isString,
    isUndefined,
    keyBy,
    mapValues,
    max,
    maxBy,
    memoize,
    merge,
    min,
    minBy,
    noop,
    omit,
    once,
    orderBy,
    partition,
    pick,
    range,
    reverse,
    round,
    sample,
    sampleSize,
    set,
    sortBy,
    sortedUniqBy,
    startCase,
    sum,
    sumBy,
    takeWhile,
    throttle,
    toString,
    union,
    unset,
    uniq,
    uniqBy,
    uniqWith,
    upperFirst,
    without,
    zip,
    lowercaseObjectKeys,
    detailOnDemandRegex,
    extractDetailsFromSyntax,
    getNextDayMidnightDate,
} from "./Util.js"

export { isPresent } from "./isPresent.js"

import dayjs from "./dayjs.js"
export { dayjs }

export type {
    Dayjs,
    customParseFormatType,
    relativeTimeType,
    utcType,
} from "./dayjs.js"

export { formatValue, checkIsVeryShortUnit } from "./formatValue.js"

export {
    timeFromTimebounds,
    minTimeBoundFromJSONOrNegativeInfinity,
    maxTimeBoundFromJSONOrPositiveInfinity,
    minTimeToJSON,
    maxTimeToJSON,
    timeBoundToTimeBoundString,
    getTimeDomainFromQueryString,
} from "./TimeBounds.js"

export {
    RegionType,
    regions,
    type Region,
    countries,
    type Country,
    getCountryBySlug,
    isCountryName,
    continents,
    type Continent,
    aggregates,
    type Aggregate,
    others,
} from "./regions.js"

export { getStylesForTargetHeight } from "./react-select.js"

export {
    type GridBounds,
    FontFamily,
    Bounds,
    DEFAULT_BOUNDS,
} from "./Bounds.js"

export {
    type Persistable,
    objectWithPersistablesToObject,
    updatePersistables,
    deleteRuntimeAndUnchangedProps,
} from "./persistable/Persistable.js"

export { PointVector } from "./PointVector.js"

export { OwidVariableDisplayConfig } from "./OwidVariable.js"

export {
    getQueryParams,
    getWindowQueryParams,
    strToQueryParams,
    queryParamsToStr,
    getWindowQueryStr,
    setWindowQueryStr,
} from "./urls/UrlUtils.js"

export { Url, setWindowUrl, getWindowUrl } from "./urls/Url.js"

export { type UrlMigration, performUrlMigrations } from "./urls/UrlMigration.js"

export {
    type GrapherConfigPatch,
    type BulkGrapherConfigResponseRow,
    type VariableAnnotationsResponseRow,
    type BulkChartEditResponseRow,
    type BulkGrapherConfigResponse,
    WHITELISTED_SQL_COLUMN_NAMES,
    variableAnnotationAllowedColumnNamesAndTypes,
    chartBulkUpdateAllowedColumnNamesAndTypes,
} from "./AdminSessionTypes.js"

export {
    setValueRecursiveInplace,
    setValueRecursive,
    compileGetValueFunction,
    applyPatch,
} from "./patchHelper.js"

export {
    EditorOption,
    FieldType,
    type FieldDescription,
    extractFieldDescriptionsFromSchema,
} from "./schemaProcessing.js"

export {
    type SExprAtom,
    type JSONPreciselyTyped,
    type JsonLogicContext,
    Arity,
    type OperationContext,
    type Operation,
    ExpressionType,
    BooleanAtom,
    NumberAtom,
    StringAtom,
    JsonPointerSymbol,
    SqlColumnName,
    ArithmeticOperator,
    allArithmeticOperators,
    ArithmeticOperation,
    NullCheckOperator,
    allNullCheckOperators,
    NullCheckOperation,
    EqualityOperator,
    allEqualityOperators,
    EqualityComparision,
    StringContainsOperation,
    ComparisonOperator,
    allComparisonOperators,
    NumericComparison,
    BinaryLogicOperators,
    allBinaryLogicOperators,
    BinaryLogicOperation,
    Negation,
    parseOperationRecursive,
    parseToOperation,
    NumericOperation,
    BooleanOperation,
    StringOperation,
} from "./SqlFilterSExpression.js"

export {
    type SearchWord,
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
    highlightFunctionForSearchWords,
} from "./search.js"

export {
    findUrlsInText,
    camelCaseProperties,
    includesCaseInsensitive,
    titleCase,
} from "./string.js"

export { serializeJSONForHTML, deserializeJSONFromHTML } from "./serializers.js"

export { PromiseCache } from "./PromiseCache.js"

export { PromiseSwitcher } from "./PromiseSwitcher.js"

export {
    getSizes,
    generateSrcSet,
    getFilenameWithoutExtension,
    getFilenameAsPng,
    type SourceProps,
    generateSourceProps,
    getFeaturedImageFilename,
} from "./image.js"

export { Tippy, TippyIfInteractive } from "./Tippy.js"

export {
    extractFormattingOptions,
    parseFormattingOptions,
    parseKeyValueArgs,
} from "./wordpressUtils.js"

// This re-exports everything in the types package from the utils package. This is done so that
// the transition is easier - we might want to get rid of this and rewrite all the imports instead
// but it's a lot of work
export * from "@ourworldindata/types"

export {
    getErrorMessageDonation,
    getCurrencySymbol,
    SUPPORTED_CURRENCY_CODES,
    MIN_DONATION_AMOUNT,
    MAX_DONATION_AMOUNT,
    PLEASE_TRY_AGAIN,
} from "./DonateUtils.js"
