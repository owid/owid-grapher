export {
    pairs,
    type NoUndefinedValues,
    type AllKeysRequired,
    type PartialBy,
    type RequiredBy,
    type PartialRecord,
    type OwidGdocPageData,
    type OwidGdocPageProps,
    createFormatter,
    getRelativeMouse,
    exposeInstanceOnWindow,
    makeSafeForCSS,
    makeIdForHumanConsumption,
    formatDay,
    formatYear,
    numberMagnitude,
    normaliseToSingleDigitNumber,
    roundSigFig,
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
    TESTING_ONLY_disable_guid,
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
    fetchJson,
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
    keyMap,
    intersectionOfSets,
    differenceOfSets,
    areSetsEqual,
    isSubsetOf,
    intersection,
    sortByUndefinedLast,
    mapNullToUndefined,
    lowerCaseFirstLetterUnlessAbbreviation,
    sortNumeric,
    findIndexFast,
    getClosestTimePairs,
    omitUndefinedValues,
    isInIFrame,
    differenceObj,
    findDOMParent,
    wrapInDiv,
    textAnchorFromAlign,
    dyFromAlign,
    stringifyUnknownError,
    toRectangularMatrix,
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
    extractGdocPageData,
    deserializeOwidGdocPageData,
    formatDate,
    canWriteToClipboard,
    isNegativeInfinity,
    isPositiveInfinity,
    imemo,
    recursivelyMapArticleContent,
    traverseEnrichedBlock,
    checkNodeIsSpan,
    extractLinksFromMarkdown,
    getPaginationPageNumbers,
    spansToUnformattedPlainText,
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
    getUniqueNamesFromTagHierarchies,
    getUserNavigatorLanguages,
    getUserNavigatorLanguagesNonEnglish,
    convertDaysSinceEpochToDate,
    logPerf,
    sleep,
    lowercaseObjectKeys,
    detailOnDemandRegex,
    guidedChartRegex,
    extractDetailsFromSyntax,
    parseFloatOrUndefined,
    bind,
    merge,
} from "./Util.js"

export {
    getOriginAttributionFragments,
    getAttributionFragmentsFromVariable,
    getETLPathComponents,
    formatAuthors,
    formatAuthorsForBibtex,
    getLastUpdatedFromVariable,
    getNextUpdateFromVariable,
    getPhraseForProcessingLevel,
    splitSourceTextIntoFragments,
    prepareSourcesForDisplay,
    formatSourceDate,
    getDateRange,
    getCitationLong,
    getCitationShort,
    getPhraseForArchivalDate,
} from "./metadataHelpers.js"

export { multiDimDimensionsToViewId, getAllVariableIds } from "./multiDim.js"

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
    listedRegionsNames,
    type Country,
    type IncomeGroup,
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
    incomeGroupsByName,
    getRegionAlternativeNames,
    mappableCountries,
    checkIsCountry,
    checkIsOwidContinent,
    checkIsIncomeGroup,
    getIncomeGroups,
    getCountryNamesForRegion,
    checkHasMembers,
    getRegionByName,
    getParentRegions,
    getSiblingRegions,
} from "./regions.js"

export { getStylesForTargetHeight } from "./react-select.js"

export { type GridBounds, FontFamily, Bounds } from "./Bounds.js"

export {
    type Persistable,
    objectWithPersistablesToObject,
    updatePersistables,
    deleteRuntimeAndUnchangedProps,
} from "./persistable/Persistable.js"

export { PointVector } from "./PointVector.js"

export { OwidVariableDisplayConfig } from "./OwidVariable.js"

export {
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
} from "./grapherConfigUtils.js"

export {
    MultiDimDataPageConfig,
    extractMultiDimChoicesFromSearchParams,
    searchParamsToMultiDimView,
} from "./MultiDimDataPageConfig.js"

export { FuzzySearch, type FuzzySearchResult } from "./FuzzySearch.js"

export {
    type ArchivalTimestamp,
    convertToArchivalDateStringIfNecessary,
    formatAsArchivalDate,
    getDateForArchival,
    parseArchivalDate,
} from "./archival/archivalDate.js"

export { experiments } from "./experiments/config.js"
export {
    Experiment,
    validateUniqueExperimentIds,
    type ExperimentArm,
} from "./experiments/Experiment.js"
export {
    getExperimentState,
    defaultExperimentState,
    type ExperimentState,
} from "./experiments/state.js"
export {
    EXPERIMENT_ARM_SEPARATOR,
    EXPERIMENT_PREFIX,
} from "./experiments/constants.js"
