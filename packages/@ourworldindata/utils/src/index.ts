export {
    pairs,
    type NoUndefinedValues,
    type AllKeysRequired,
    type PartialBy,
    type RequiredBy,
    type PartialRecord,
    createFormatter,
    getRelativeMouse,
    exposeInstanceOnWindow,
    makeSafeForCSS,
    makeIdForHumanConsumption,
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
    escapeRegExp,
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
    dateDiffInDays,
    diffDateISOStringInDays,
    getYearFromISOStringAndDayOffset,
    parseIntOrUndefined,
    anyToString,
    scrollIntoViewIfNeeded,
    rollingMap,
    groupMap,
    keyMap,
    intersectionOfSets,
    unionOfSets,
    differenceOfSets,
    areSetsEqual,
    isSubsetOf,
    intersection,
    sortByUndefinedLast,
    mapNullToUndefined,
    lowerCaseFirstLetterUnlessAbbreviation,
    sortNumeric,
    mapBy,
    findIndexFast,
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
    checkIsTouchEvent,
    triggerDownloadFromBlob,
    triggerDownloadFromUrl,
    removeAllWhitespace,
    moveArrayItemToIndex,
    getIndexableKeys,
    retryPromise,
    fetchWithRetry,
    getOwidGdocFromJSON,
    formatDate,
    canWriteToClipboard,
    isNegativeInfinity,
    isPositiveInfinity,
    imemo,
    recursivelyMapArticleContent,
    traverseEnrichedBlock,
    checkNodeIsSpan,
    checkNodeIsSpanLink,
    getPaginationPageNumbers,
    spansToUnformattedPlainText,
    findDuplicates,
    checkIsOwidGdocType,
    isArrayOfNumbers,
    greatestCommonDivisor,
    findGreatestCommonDivisorOfArray,
    type NodeWithUrl,
    filterValidStringValues,
    traverseEnrichedSpan,
    copyToClipboard,
    checkIsGdocPost,
    checkIsGdocPostExcludingFragments,
    checkIsDataInsight,
    checkIsAuthor,
    cartesian,
    removeTrailingParenthetical,
    isElementHidden,
    commafyNumber,
    isFiniteWithGuard,
    createTagGraph,
    getAllChildrenOfArea,
    flattenNonTopicNodes,
    formatInlineList,
    lazy,
    getParentVariableIdFromChartConfig,
    isArrayDifferentFromReference,
    readFromAssetMap,
    downloadImage,
    getUniqueNamesFromParentTagArrays,
    getUserNavigatorLanguages,
    getUserNavigatorLanguagesNonEnglish,
    convertDaysSinceEpochToDate,
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
    getDateRange,
    getCitationLong,
    getCitationShort,
    grabMetadataForGdocLinkedIndicator,
} from "./metadataHelpers.js"

export { multiDimDimensionsToViewId } from "./multiDim.js"

export {
    capitalize,
    chunk,
    clamp,
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
    get,
    groupBy,
    identity,
    invert,
    isArray,
    isBoolean,
    isEmpty,
    isEqual,
    isInteger,
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
    sortedIndexBy,
    sortedUniqBy,
    startCase,
    sum,
    sumBy,
    takeWhile,
    tail,
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
    delay,
} from "./Util.js"

export { isPresent } from "./isPresent.js"

import dayjs from "./dayjs.js"
export { dayjs }

export type {
    Dayjs,
    customParseFormatType,
    isTodayType,
    isYesterdayType,
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
    type OwidIncomeGroupName,
    checkIsOwidIncomeGroupName,
    getCountryBySlug,
    getCountryByName,
    getRegionByNameOrVariantName,
    isCountryName,
    getContinents,
    type Continent,
    getAggregates,
    type Aggregate,
    type AggregateSource,
    aggregateSources,
    getOthers,
    countriesByName,
    getRegionAlternativeNames,
    mappableCountries,
    regionsByName,
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
    camelCaseProperties,
    titleCase,
    toAsciiQuotes,
    removeDiacritics,
} from "./string.js"

export { serializeJSONForHTML, deserializeJSONFromHTML } from "./serializers.js"

export { PromiseCache } from "./PromiseCache.js"

export { PromiseSwitcher } from "./PromiseSwitcher.js"

export {
    THUMBNAIL_WIDTH,
    LARGE_THUMBNAIL_WIDTH,
    LARGEST_IMAGE_WIDTH,
    getSizes,
    generateSrcSet,
    getFilenameWithoutExtension,
    getFilenameAsPng,
    getFilenameExtension,
    getFilenameMIMEType,
    type SourceProps,
    generateSourceProps,
    getFeaturedImageFilename,
} from "./image.js"

export { Tippy, TippyIfInteractive } from "./Tippy.js"

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

export { isAndroid, isIOS } from "./BrowserUtils.js"

export {
    diffGrapherConfigs,
    mergeGrapherConfigs,
    simpleMerge,
} from "./grapherConfigUtils.js"

export {
    MultiDimDataPageConfig,
    extractMultiDimChoicesFromSearchParams,
    searchParamsToMultiDimView,
} from "./MultiDimDataPageConfig.js"

export { FuzzySearch, type FuzzySearchResult } from "./FuzzySearch.js"
