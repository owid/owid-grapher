/**
 * Strategies:
 * - The log scales result in log-like steps, e.g. 1, 2, 5, 10, ...
 *   They are fully defined given a minValue, maxValue and step size, and
 *   then generate as many bins as needed to cover the range.
 *   `log-auto` chooses the step size automatically in order to get a decent number of bins.
 * - The equal size bins result in evenly spaced steps, e.g. 0, 1, 2, 3, ...
 *   They are defined by a minValue, maxValue, and a rough target number of bins.
 *   `equalSizeBins-few-bins` chooses a small number of bins, while
 *   `equalSizeBins-many-bins` chooses a large number of bins.
 *   They then generate nice round bin thresholds given the input data.
 * - `equalSizeBins-percent` is a special case, where for data that looks like percent
 *   from 0% to 100% we want to mostly use 0%, 10%, 20%, etc. bins.
 */

export const logBinningStrategies = [
    "log-auto",
    "log-1-2-5",
    "log-1-3",
    "log-10",
] as const

export const equalSizeBinningStrategies = [
    "equalSizeBins-normal",
    "equalSizeBins-few-bins",
    "equalSizeBins-many-bins",
    "equalSizeBins-percent",
] as const

export const automaticBinningStrategies = [
    "auto",
    ...logBinningStrategies,
    ...equalSizeBinningStrategies,
] as const

export type LogBinningStrategy = (typeof logBinningStrategies)[number]
export type EqualSizeBinningStrategy =
    (typeof equalSizeBinningStrategies)[number]

export type ResolvedLogBinningStrategy = Exclude<LogBinningStrategy, "log-auto">

export type BinningStrategy = (typeof automaticBinningStrategies)[number]

export type ResolvedBinningStrategy = Exclude<BinningStrategy, "auto">

/**
 * Sometimes, we do have a midpoint in our data. In many cases, a natural midpoint is zero
 * (e.g. for year-over-year change, net migration, temperature anomaly, etc.), but other
 * midpoints also make sense (e.g. for sex ratio).
 * If we have a midpoint, then we want to account for it when binning, and generate bins
 * that are centered or symmetric around the midpoint.
 */
export const binningMidpointModes = [
    undefined, // Automatic
    "none", // No midpoint
    "symmetric", // Symmetric bins around a midpoint, with negBins = -1 * posBins
    "same-num-bins", // Symmetric bins around a midpoint, with negBins.length = posBins.length
    "asymmetric", // Bins around a midpoint, with negBins.length not necessarily equal to posBins.length
] as const
export type MidpointMode = (typeof binningMidpointModes)[number]
