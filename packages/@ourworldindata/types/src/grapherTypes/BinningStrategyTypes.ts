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

export const binningStrategiesIncludingManual = [
    "manual",
    ...automaticBinningStrategies,
] as const

export type LogBinningStrategy = (typeof logBinningStrategies)[number]
export type EqualSizeBinningStrategy =
    (typeof equalSizeBinningStrategies)[number]

export type ResolvedLogBinningStrategy = Exclude<LogBinningStrategy, "log-auto">

export type AutomaticBinningStrategy =
    (typeof automaticBinningStrategies)[number]

export type ResolvedBinningStrategy = Exclude<AutomaticBinningStrategy, "auto">
export type BinningStrategyIncludingManual =
    (typeof binningStrategiesIncludingManual)[number]

export const binningMidpointModes = [
    undefined, // Automatic
    "none", // No midpoint
    "symmetric", // Symmetric bins around a midpoint, with negBins = -1 * posBins
    "same-num-bins", // Symmetric bins around a midpoint, with negBins.length = posBins.length
    "asymmetric", // Bins around a midpoint, with negBins.length not necessarily equal to posBins.length
] as const
export type MidpointMode = (typeof binningMidpointModes)[number]
