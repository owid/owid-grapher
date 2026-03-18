/**
 * Cohort-component population projection model.
 * Uses single-year ages (0-130) for accurate aging.
 */

import {
    MAX_AGE,
    OWID_AGE_GROUPS,
    FERTILITY_AGE_GROUPS,
} from "../helpers/constants"
import type {
    CountryData,
    PopulationBySex,
    DeathsByAgeGroup,
    MortalityRates,
} from "../helpers/types"
import {
    getAgeGroupStart,
    expandToSingleYearAges,
    getPopulationForYear,
    getDeathsForYear,
    getMigrationRateForYear,
    getTotalPopulation,
} from "../helpers/utils"

// -- Model-only data accessors --

function getAgeGroup(age: number): string {
    if (age >= 100) return "100+"
    const lower = Math.floor(age / 5) * 5
    return `${lower}-${lower + 4}`
}

function aggregateToAgeGroups(
    singleYearArray: number[]
): Record<string, number> {
    const result: Record<string, number> = {}

    for (const ageGroup of OWID_AGE_GROUPS) {
        if (ageGroup === "100+") {
            let sum = 0
            for (let age = 100; age <= MAX_AGE; age++) {
                sum += singleYearArray[age] || 0
            }
            result[ageGroup] = sum
        } else {
            const startAge = getAgeGroupStart(ageGroup)
            let sum = 0
            for (let age = startAge; age < startAge + 5; age++) {
                sum += singleYearArray[age] || 0
            }
            result[ageGroup] = sum
        }
    }

    return result
}

function getRawPopulationForYear(
    data: CountryData,
    year: number
): { female: Record<string, number>; male: Record<string, number> } {
    return {
        female: data.femalePopulation[year],
        male: data.malePopulation[year],
    }
}

function getFertilityForYear(data: CountryData, year: number): number[] | null {
    const row = data.fertility[year]
    if (!row) return null

    const result = new Array(MAX_AGE + 1).fill(0)
    for (const ageGroup of FERTILITY_AGE_GROUPS) {
        const rate = row[ageGroup] || 0
        const startAge = getAgeGroupStart(ageGroup)
        for (let age = startAge; age < startAge + 5 && age <= MAX_AGE; age++) {
            result[age] = rate
        }
    }
    return result
}

// -- Mortality helpers --

function clampProbability(value: number, min = 1e-6, max = 0.999): number {
    if (!Number.isFinite(value)) return min
    return Math.min(max, Math.max(min, value))
}

function logit(p: number): number {
    const q = clampProbability(p)
    return Math.log(q / (1 - q))
}

function invLogit(z: number): number {
    return 1 / (1 + Math.exp(-z))
}

/**
 * Apply a Kannisto-like old-age closure so mortality rises smoothly and monotonically.
 */
export function applyOldAgeClosure(rates: number[], sex: string): number[] {
    const closed = [...rates]
    const startAge = 85
    const anchorAge = 100

    const qStartObserved = closed[startAge] ?? closed[80] ?? 0.05
    const qAnchorObserved =
        closed[anchorAge] ?? closed[95] ?? (sex === "female" ? 0.55 : 0.6)

    const qStart = clampProbability(qStartObserved, 1e-5, 0.98)
    const qAnchor = clampProbability(
        Math.max(qAnchorObserved, qStart + 0.01),
        qStart + 1e-5,
        0.995
    )

    let slope = (logit(qAnchor) - logit(qStart)) / (anchorAge - startAge)
    if (!Number.isFinite(slope) || slope < 0.005) {
        slope = 0.005
    }

    const intercept = logit(qStart)
    let prev = qStart

    for (let age = startAge; age <= MAX_AGE; age++) {
        let qx = invLogit(intercept + slope * (age - startAge))
        qx = clampProbability(Math.max(qx, prev), 1e-6, 0.999)
        closed[age] = qx
        prev = qx
    }

    return closed
}

export function calculateMortalityRates(
    deaths: DeathsByAgeGroup,
    femalePop: number[],
    malePop: number[]
): MortalityRates {
    const result: MortalityRates = {
        female: new Array(MAX_AGE + 1).fill(0),
        male: new Array(MAX_AGE + 1).fill(0),
    }

    for (const sex of ["female", "male"] as const) {
        const pop = sex === "female" ? femalePop : malePop
        const sexDeaths = deaths[sex] || {}
        const groupRates: Record<string, number> = {}

        for (const ageGroup of OWID_AGE_GROUPS) {
            const startAge = getAgeGroupStart(ageGroup)
            const endAge =
                ageGroup === "100+" ? Math.min(104, MAX_AGE) : startAge + 4

            let totalPop = 0
            for (let age = startAge; age <= endAge; age++) {
                totalPop += pop[age] || 0
            }

            const deathCount = sexDeaths[ageGroup] || 0
            groupRates[ageGroup] =
                totalPop > 0 ? Math.min(deathCount / totalPop, 1.0) : 0
        }

        for (let age = 0; age <= MAX_AGE; age++) {
            const ageGroup = getAgeGroup(age)
            result[sex][age] = groupRates[ageGroup] || 0
        }

        result[sex] = applyOldAgeClosure(result[sex], sex)
    }

    return result
}

// -- UN WPP projection scenario data accessors --

export function getProjectionFertilityForYear(
    data: CountryData,
    year: number
): number[] | null {
    const row = data.projectionScenario?.fertility?.[year]
    if (!row) return null

    const result = new Array(MAX_AGE + 1).fill(0)
    for (const ageGroup of FERTILITY_AGE_GROUPS) {
        const rate = row[ageGroup] || 0
        const startAge = getAgeGroupStart(ageGroup)
        for (let age = startAge; age < startAge + 5 && age <= MAX_AGE; age++) {
            result[age] = rate
        }
    }
    return result
}

export function getProjectionDeathsForYear(
    data: CountryData,
    year: number
): DeathsByAgeGroup | null {
    const femaleRow = data.projectionScenario?.deaths?.female?.[year]
    const maleRow = data.projectionScenario?.deaths?.male?.[year]
    if (!femaleRow && !maleRow) return null

    const result: DeathsByAgeGroup = { female: {}, male: {} }
    for (const ageGroup of OWID_AGE_GROUPS) {
        result.female[ageGroup] = femaleRow?.[ageGroup] || 0
        result.male[ageGroup] = maleRow?.[ageGroup] || 0
    }
    return result
}

export function getProjectionMigrationRateForYear(
    data: CountryData,
    year: number
): number {
    const row = data.projectionScenario?.migration?.[year]
    return row ? row.net_migration_rate : 0
}

export function getProjectionPopulationForYear(
    data: CountryData,
    year: number
): PopulationBySex | null {
    const femaleRow = data.projection?.female?.[year]
    const maleRow = data.projection?.male?.[year]

    if (!femaleRow || !maleRow) return null

    return {
        female: expandToSingleYearAges(femaleRow),
        male: expandToSingleYearAges(maleRow),
    }
}

// -- Migration schedules --

const MIGRATION_SCHEDULES_BY_GROUP: Record<string, Record<string, number>> = {
    western_standard: {
        "0-4": 0.07,
        "5-9": 0.05,
        "10-14": 0.03,
        "15-19": 0.07,
        "20-24": 0.14,
        "25-29": 0.18,
        "30-34": 0.15,
        "35-39": 0.1,
        "40-44": 0.07,
        "45-49": 0.05,
        "50-54": 0.03,
        "55-59": 0.02,
        "60-64": 0.015,
        "65-69": 0.008,
        "70-74": 0.006,
        "75-79": 0.004,
        "80-84": 0.003,
        "85-89": 0.002,
        "90-94": 0.001,
        "95-99": 0.0005,
        "100+": 0.0005,
    },
    low_dependency: {
        "0-4": 0.03,
        "5-9": 0.02,
        "10-14": 0.01,
        "15-19": 0.08,
        "20-24": 0.18,
        "25-29": 0.23,
        "30-34": 0.2,
        "35-39": 0.12,
        "40-44": 0.06,
        "45-49": 0.03,
        "50-54": 0.015,
        "55-59": 0.008,
        "60-64": 0.004,
        "65-69": 0.002,
        "70-74": 0.0015,
        "75-79": 0.001,
        "80-84": 0.0008,
        "85-89": 0.0005,
        "90-94": 0.0003,
        "95-99": 0.0002,
        "100+": 0.0002,
    },
}

export interface MigrationOptions {
    schedule: string
    direction: string
    sexPattern: string
    flowTurnoverRate: number
    oldAgeNetMigrationCutoff: number
    externalSexShareBlend: number
    immigrationMaleSharePrior: number | null
    emigrationMaleSharePrior: number | null
}

export const DEFAULT_MIGRATION_OPTIONS: MigrationOptions = {
    schedule: "western_standard",
    direction: "auto",
    sexPattern: "neutral",
    flowTurnoverRate: 0,
    oldAgeNetMigrationCutoff: 75,
    externalSexShareBlend: 0.35,
    immigrationMaleSharePrior: null,
    emigrationMaleSharePrior: null,
}

let activeMigrationOptions: MigrationOptions = { ...DEFAULT_MIGRATION_OPTIONS }

// -- External migration sex share priors --

const EXTERNAL_MIGRATION_SEX_SHARE_PRIORS: Record<
    string,
    { immigrationMaleShare: number; emigrationMaleShare: number }
> = {
    Bahrain: { immigrationMaleShare: 0.7, emigrationMaleShare: 0.66 },
    Kuwait: { immigrationMaleShare: 0.68, emigrationMaleShare: 0.64 },
    Oman: { immigrationMaleShare: 0.66, emigrationMaleShare: 0.62 },
    Qatar: { immigrationMaleShare: 0.74, emigrationMaleShare: 0.7 },
    "Saudi Arabia": { immigrationMaleShare: 0.65, emigrationMaleShare: 0.61 },
    "United Arab Emirates": {
        immigrationMaleShare: 0.76,
        emigrationMaleShare: 0.72,
    },
}

const POOLED_MIGRATION_DEFAULTS_BY_REGIME: Record<
    string,
    Partial<MigrationOptions>
> = {
    receiving: {
        schedule: "western_standard",
        direction: "auto",
        sexPattern: "neutral",
        flowTurnoverRate: 0,
        oldAgeNetMigrationCutoff: 75,
    },
    sending: {
        schedule: "western_standard",
        direction: "auto",
        sexPattern: "neutral",
        flowTurnoverRate: 0,
        oldAgeNetMigrationCutoff: 75,
    },
    balanced: {
        schedule: "western_standard",
        direction: "auto",
        sexPattern: "neutral",
        flowTurnoverRate: 0,
        oldAgeNetMigrationCutoff: 75,
    },
}

const MIGRATION_OPTIMIZATION_WEIGHTS = {
    oneStep: 1.0,
    cumulativeMape: 0.8,
    cumulativeEndAbsPct: 0.6,
    unMape: 0.55,
    unEndAbsPct: 0.35,
}

const DEFAULT_MIGRATION_OPTIMIZATION_YEARS = 15
const MIN_STRONG_YEARS_FOR_COUNTRY_OPTIMIZATION = 10
const MIN_OPTIMIZATION_IMPROVEMENT = 0.02
const SCHEDULE_SWITCH_MIN_IMPROVEMENT = 0.06

// -- Utility --

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value)
}

function getExternalSexSharePrior(country: string) {
    return EXTERNAL_MIGRATION_SEX_SHARE_PRIORS[country] || null
}

function normalizeWeights(weights: number[]): number[] {
    const normalized = [...weights]
    const total = normalized.reduce((sum, v) => sum + v, 0)
    if (total <= 0) return normalized
    for (let i = 0; i < normalized.length; i++) {
        normalized[i] /= total
    }
    return normalized
}

function buildAgeWeightsFromGroups(
    groupWeights: Record<string, number>
): number[] {
    const weights = new Array(MAX_AGE + 1).fill(0)
    for (const [ageGroup, value] of Object.entries(groupWeights)) {
        if (ageGroup === "100+") {
            const span = MAX_AGE - 99
            const perYear = value / span
            for (let age = 100; age <= MAX_AGE; age++) {
                weights[age] += perYear
            }
            continue
        }
        const startAge = parseInt(ageGroup.split("-")[0], 10)
        const perYear = value / 5
        for (let age = startAge; age < startAge + 5 && age <= MAX_AGE; age++) {
            weights[age] += perYear
        }
    }
    return normalizeWeights(weights)
}

export const MIGRATION_BASE_AGE_WEIGHTS: Record<string, number[]> = {
    western_standard: buildAgeWeightsFromGroups(
        MIGRATION_SCHEDULES_BY_GROUP.western_standard
    ),
    low_dependency: buildAgeWeightsFromGroups(
        MIGRATION_SCHEDULES_BY_GROUP.low_dependency
    ),
}

function shiftAgeWeights(ageWeights: number[], shiftYears: number): number[] {
    const shifted = new Array(MAX_AGE + 1).fill(0)
    for (let age = 0; age <= MAX_AGE; age++) {
        const targetAge = Math.max(
            0,
            Math.min(MAX_AGE, Math.round(age + shiftYears))
        )
        shifted[targetAge] += ageWeights[age] || 0
    }
    return normalizeWeights(shifted)
}

function applySexAgeTilt(
    ageWeights: number[],
    sexPattern: string,
    sex: string
): number[] {
    if (sexPattern === "neutral") return [...ageWeights]

    const weights = [...ageWeights]
    const isYoungerMale = sexPattern === "younger_male"
    const tiltYoungSex = isYoungerMale ? "male" : "female"

    for (let age = 0; age <= MAX_AGE; age++) {
        let factor = 1
        if (sex === tiltYoungSex) {
            if (age < 18) factor = 1.08
            else if (age <= 39) factor = 1.18
            else if (age <= 64) factor = 0.9
            else factor = 0.78
        } else {
            if (age < 18) factor = 0.92
            else if (age <= 39) factor = 0.85
            else if (age <= 64) factor = 1.1
            else factor = 1.22
        }
        weights[age] *= factor
    }

    return normalizeWeights(weights)
}

function blendSexShareWithExternalPrior(
    baseShare: number,
    priorShare: number | null,
    blendWeight: number
): number {
    if (!isFiniteNumber(priorShare)) {
        return clamp(baseShare, 0.05, 0.95)
    }
    const blend = clamp(Number(blendWeight) || 0, 0, 1)
    const priorClamped = clamp(Number(priorShare), 0.1, 0.9)
    const parityShrunkPrior = 0.5 + (priorClamped - 0.5) * 0.7
    return clamp(
        baseShare * (1 - blend) + parityShrunkPrior * blend,
        0.05,
        0.95
    )
}

function getFlowSexShares(
    options: MigrationOptions,
    flowType: "immigration" | "emigration"
): { male: number; female: number } {
    const priorShare =
        flowType === "immigration"
            ? options.immigrationMaleSharePrior
            : options.emigrationMaleSharePrior
    const blendWeight =
        options.externalSexShareBlend ??
        DEFAULT_MIGRATION_OPTIONS.externalSexShareBlend

    let maleShare: number
    if (options.sexPattern === "younger_male") {
        maleShare = flowType === "immigration" ? 0.56 : 0.53
    } else if (options.sexPattern === "younger_female") {
        maleShare = flowType === "immigration" ? 0.44 : 0.47
    } else {
        maleShare = 0.5
    }

    maleShare = blendSexShareWithExternalPrior(
        maleShare,
        priorShare,
        blendWeight
    )
    return { male: maleShare, female: 1 - maleShare }
}

function buildFlowAgeSexWeights(options: MigrationOptions) {
    const schedule = MIGRATION_BASE_AGE_WEIGHTS[options.schedule]
        ? options.schedule
        : "western_standard"
    const baseAgeWeights = MIGRATION_BASE_AGE_WEIGHTS[schedule]

    const youngerAgeWeights = shiftAgeWeights(baseAgeWeights, -2)
    const olderAgeWeights = shiftAgeWeights(baseAgeWeights, 6)

    const immigrationAgeWeights =
        options.direction === "sending" ? olderAgeWeights : youngerAgeWeights
    const emigrationAgeWeights =
        options.direction === "sending" ? youngerAgeWeights : olderAgeWeights

    const immigrationSexShares = getFlowSexShares(options, "immigration")
    const emigrationSexShares = getFlowSexShares(options, "emigration")

    const immigration: PopulationBySex = {
        female: new Array(MAX_AGE + 1).fill(0),
        male: new Array(MAX_AGE + 1).fill(0),
    }
    const emigration: PopulationBySex = {
        female: new Array(MAX_AGE + 1).fill(0),
        male: new Array(MAX_AGE + 1).fill(0),
    }

    const femaleImmAge = applySexAgeTilt(
        immigrationAgeWeights,
        options.sexPattern,
        "female"
    )
    const maleImmAge = applySexAgeTilt(
        immigrationAgeWeights,
        options.sexPattern,
        "male"
    )
    const femaleEmAge = applySexAgeTilt(
        emigrationAgeWeights,
        options.sexPattern,
        "female"
    )
    const maleEmAge = applySexAgeTilt(
        emigrationAgeWeights,
        options.sexPattern,
        "male"
    )

    for (let age = 0; age <= MAX_AGE; age++) {
        immigration.female[age] =
            femaleImmAge[age] * immigrationSexShares.female
        immigration.male[age] = maleImmAge[age] * immigrationSexShares.male
        emigration.female[age] = femaleEmAge[age] * emigrationSexShares.female
        emigration.male[age] = maleEmAge[age] * emigrationSexShares.male
    }

    const redistributionAge = new Array(MAX_AGE + 1).fill(0)
    const cutoff =
        options.oldAgeNetMigrationCutoff ??
        DEFAULT_MIGRATION_OPTIONS.oldAgeNetMigrationCutoff
    for (let age = 0; age <= MAX_AGE; age++) {
        if (age >= cutoff) continue
        redistributionAge[age] =
            (immigrationAgeWeights[age] + emigrationAgeWeights[age]) / 2
    }

    return {
        immigration,
        emigration,
        redistributionAge: normalizeWeights(redistributionAge),
    }
}

function splitNetMigrationFlows(
    totalPopulation: number,
    migrationRate: number,
    flowTurnoverRate: number
) {
    const netMigrants = (totalPopulation * migrationRate) / 1000
    const turnoverRate = Math.max(0, flowTurnoverRate)

    let immigrants = totalPopulation * turnoverRate + netMigrants / 2
    let emigrants = totalPopulation * turnoverRate - netMigrants / 2

    if (immigrants < 0 || emigrants < 0) {
        immigrants = Math.max(netMigrants, 0)
        emigrants = Math.max(-netMigrants, 0)
    }

    return { immigrants, emigrants }
}

function applyOldAgeNetMigrationGuardrail(
    delta: PopulationBySex,
    redistributionAge: number[],
    cutoff: number
) {
    for (const sex of ["female", "male"] as const) {
        let excess = 0
        for (let age = cutoff; age <= MAX_AGE; age++) {
            excess += delta[sex][age]
            delta[sex][age] = 0
        }

        if (Math.abs(excess) < 1e-9) continue
        for (let age = 0; age < cutoff; age++) {
            delta[sex][age] += excess * (redistributionAge[age] || 0)
        }
    }
}

function calculateMigrationDelta(
    populationAfterMortalityAndAging: PopulationBySex,
    totalPopulation: number,
    migrationRate: number,
    options: MigrationOptions
): PopulationBySex {
    const flowTurnoverRate =
        options.flowTurnoverRate ?? DEFAULT_MIGRATION_OPTIONS.flowTurnoverRate
    const effectiveDirection =
        options.direction === "auto"
            ? migrationRate >= 0
                ? "receiving"
                : "sending"
            : options.direction
    const { immigrants, emigrants } = splitNetMigrationFlows(
        totalPopulation,
        migrationRate,
        flowTurnoverRate
    )
    const schedules = buildFlowAgeSexWeights({
        ...options,
        direction: effectiveDirection,
    })

    const delta: PopulationBySex = {
        female: new Array(MAX_AGE + 1).fill(0),
        male: new Array(MAX_AGE + 1).fill(0),
    }

    for (const sex of ["female", "male"] as const) {
        for (let age = 0; age <= MAX_AGE; age++) {
            delta[sex][age] +=
                immigrants * (schedules.immigration[sex][age] || 0)
        }
    }

    let removedTotal = 0
    for (const sex of ["female", "male"] as const) {
        for (let age = 0; age <= MAX_AGE; age++) {
            const desired = emigrants * (schedules.emigration[sex][age] || 0)
            const available = Math.max(
                0,
                (populationAfterMortalityAndAging[sex][age] || 0) +
                    delta[sex][age]
            )
            const removed = Math.min(desired, available)
            delta[sex][age] -= removed
            removedTotal += removed
        }
    }

    const remainingToRemove = Math.max(0, emigrants - removedTotal)
    if (remainingToRemove > 1e-6) {
        let availableTotal = 0
        for (const sex of ["female", "male"] as const) {
            for (let age = 0; age <= MAX_AGE; age++) {
                availableTotal += Math.max(
                    0,
                    (populationAfterMortalityAndAging[sex][age] || 0) +
                        delta[sex][age]
                )
            }
        }
        if (availableTotal > 0) {
            for (const sex of ["female", "male"] as const) {
                for (let age = 0; age <= MAX_AGE; age++) {
                    const available = Math.max(
                        0,
                        (populationAfterMortalityAndAging[sex][age] || 0) +
                            delta[sex][age]
                    )
                    delta[sex][age] -=
                        remainingToRemove * (available / availableTotal)
                }
            }
        }
    }

    const cutoff =
        options.oldAgeNetMigrationCutoff ??
        DEFAULT_MIGRATION_OPTIONS.oldAgeNetMigrationCutoff
    applyOldAgeNetMigrationGuardrail(delta, schedules.redistributionAge, cutoff)

    return delta
}

// -- Core simulation --

const MALE_BIRTH_RATIO = 0.512
const FEMALE_BIRTH_RATIO = 0.488

export function clonePopulation(pop: PopulationBySex): PopulationBySex {
    return { female: [...pop.female], male: [...pop.male] }
}

export function getTotalPopulationFromArrays(
    female: number[],
    male: number[]
): number {
    let total = 0
    for (let age = 0; age <= MAX_AGE; age++) {
        total += (female[age] || 0) + (male[age] || 0)
    }
    return total
}

export function simulateYear(
    population: PopulationBySex,
    mortalityRates: { female: number[]; male: number[] },
    fertilityRates: number[],
    migrationRate: number,
    migrationOptionsOverride: MigrationOptions | null = null
): PopulationBySex {
    const newPop: PopulationBySex = {
        female: new Array(MAX_AGE + 1).fill(0),
        male: new Array(MAX_AGE + 1).fill(0),
    }

    // Step 1 & 2: Apply deaths and age the population
    for (let age = 0; age <= MAX_AGE; age++) {
        const femaleSurvivors =
            (population.female[age] || 0) *
            (1 - (mortalityRates.female?.[age] || 0))
        const maleSurvivors =
            (population.male[age] || 0) *
            (1 - (mortalityRates.male?.[age] || 0))

        if (age === MAX_AGE) {
            newPop.female[MAX_AGE] += femaleSurvivors
            newPop.male[MAX_AGE] += maleSurvivors
        } else {
            newPop.female[age + 1] += femaleSurvivors
            newPop.male[age + 1] += maleSurvivors
        }
    }

    // Step 3: Apply net migration
    const effectiveMigrationOptions =
        migrationOptionsOverride || activeMigrationOptions
    const totalPop = getTotalPopulationFromArrays(
        population.female,
        population.male
    )
    const migrationDelta = calculateMigrationDelta(
        newPop,
        totalPop,
        migrationRate,
        effectiveMigrationOptions
    )
    for (let age = 0; age <= MAX_AGE; age++) {
        newPop.female[age] += migrationDelta.female[age]
        newPop.male[age] += migrationDelta.male[age]
    }

    // Step 4: Calculate births
    let totalBirths = 0
    for (let age = 10; age <= 54; age++) {
        const fertilityRate = fertilityRates[age] || 0
        if (fertilityRate > 0) {
            const avgFemalePop =
                ((population.female[age] || 0) + (newPop.female[age] || 0)) / 2
            totalBirths += (avgFemalePop * fertilityRate) / 1000
        }
    }

    newPop.female[0] += totalBirths * FEMALE_BIRTH_RATIO
    newPop.male[0] += totalBirths * MALE_BIRTH_RATIO

    // Ensure no negative populations
    for (let age = 0; age <= MAX_AGE; age++) {
        newPop.female[age] = Math.max(0, newPop.female[age])
        newPop.male[age] = Math.max(0, newPop.male[age])
    }

    return newPop
}

// -- Historical projection --

export interface YearResult {
    population: PopulationBySex
    totalPop: number
}

export function runHistoricalProjection(
    data: CountryData,
    startYear: number,
    endYear: number,
    options: { migrationOptions?: MigrationOptions } = {}
): Record<number, YearResult> {
    const results: Record<number, YearResult> = {}
    const migrationOptions = options.migrationOptions || activeMigrationOptions

    let population = getPopulationForYear(data, startYear)
    if (!population) {
        throw new Error(`No population data for year ${startYear}`)
    }

    results[startYear] = {
        population: clonePopulation(population),
        totalPop: getTotalPopulationFromArrays(
            population.female,
            population.male
        ),
    }

    for (let year = startYear; year < endYear; year++) {
        const deaths = getDeathsForYear(data, year)
        const fertility = getFertilityForYear(data, year)
        const migrationRate = getMigrationRateForYear(data, year)

        if (!deaths || !fertility) {
            console.warn(`Missing data for year ${year}`)
            continue
        }

        const mortalityRates = calculateMortalityRates(
            deaths,
            population.female,
            population.male
        )

        population = simulateYear(
            population,
            mortalityRates,
            fertility,
            migrationRate,
            migrationOptions
        )

        results[year + 1] = {
            population: clonePopulation(population),
            totalPop: getTotalPopulationFromArrays(
                population.female,
                population.male
            ),
        }
    }

    return results
}

// -- Comparison --

export function compareWithActual(
    data: CountryData,
    modeledPopulation: PopulationBySex,
    year: number
) {
    const rawActual = getRawPopulationForYear(data, year)
    if (!rawActual.female || !rawActual.male) return null

    const modeledFemaleGroups = aggregateToAgeGroups(modeledPopulation.female)
    const modeledMaleGroups = aggregateToAgeGroups(modeledPopulation.male)
    const modeledTotal = getTotalPopulationFromArrays(
        modeledPopulation.female,
        modeledPopulation.male
    )

    let actualTotal = 0
    for (const ageGroup of OWID_AGE_GROUPS) {
        actualTotal +=
            (rawActual.female[ageGroup] || 0) + (rawActual.male[ageGroup] || 0)
    }

    const diff = modeledTotal - actualTotal
    const pctError = (diff / actualTotal) * 100

    const byAgeGroup: Record<
        string,
        { actual: number; modeled: number; diff: number; pctError: number }
    > = {}
    for (const ageGroup of OWID_AGE_GROUPS) {
        const actualCount =
            (rawActual.female[ageGroup] || 0) + (rawActual.male[ageGroup] || 0)
        const modeledCount =
            (modeledFemaleGroups[ageGroup] || 0) +
            (modeledMaleGroups[ageGroup] || 0)
        byAgeGroup[ageGroup] = {
            actual: actualCount,
            modeled: modeledCount,
            diff: modeledCount - actualCount,
            pctError:
                actualCount > 0
                    ? ((modeledCount - actualCount) / actualCount) * 100
                    : 0,
        }
    }

    return { actualTotal, modeledTotal, diff, pctError, byAgeGroup }
}

// -- Life expectancy & TFR --

export function calculateLifeExpectancy(mortalityRates: number[]): number {
    let survivors = 100000
    let totalYearsLived = 0

    for (let age = 0; age <= MAX_AGE; age++) {
        const rate = Math.min(mortalityRates[age] || 0, 1)
        const deaths = survivors * rate
        const avgSurvivors = survivors - deaths / 2
        totalYearsLived += avgSurvivors
        survivors -= deaths
        if (survivors <= 0) break
    }

    return totalYearsLived / 100000
}

export function calculateTFR(fertilityRates: number[]): number {
    let tfr = 0
    for (let age = 10; age <= 54; age++) {
        tfr += (fertilityRates[age] || 0) / 1000
    }
    return tfr
}

// -- Baseline rates --

export interface BaselineParams {
    fertility: number[]
    mortality: { female: number[]; male: number[] }
    migrationRate: number
    tfr: number
    lifeExpectancy: number
}

export function calculateBaselineRates(
    data: CountryData,
    startYear: number,
    endYear: number,
    historicalResults: Record<number, YearResult> = {}
): BaselineParams {
    const numYears = endYear - startYear + 1

    const fertilitySum = new Array(MAX_AGE + 1).fill(0)
    const mortalitySum = {
        female: new Array(MAX_AGE + 1).fill(0),
        male: new Array(MAX_AGE + 1).fill(0),
    }
    let migrationSum = 0
    let mortalityYears = 0

    for (let year = startYear; year <= endYear; year++) {
        const fertility = getFertilityForYear(data, year)
        if (fertility) {
            for (let age = 0; age <= MAX_AGE; age++) {
                fertilitySum[age] += fertility[age] || 0
            }
        }

        const deaths = getDeathsForYear(data, year)
        const observedPopulation = getPopulationForYear(data, year)
        const fallbackPopulation = historicalResults[year]?.population
        const exposurePopulation = observedPopulation || fallbackPopulation

        if (deaths && exposurePopulation) {
            const mortalityRates = calculateMortalityRates(
                deaths,
                exposurePopulation.female,
                exposurePopulation.male
            )
            for (let age = 0; age <= MAX_AGE; age++) {
                mortalitySum.female[age] += mortalityRates.female[age] || 0
                mortalitySum.male[age] += mortalityRates.male[age] || 0
            }
            mortalityYears++
        }

        migrationSum += getMigrationRateForYear(data, year) || 0
    }

    const fertility = fertilitySum.map((f) => f / numYears)
    const mortality = {
        female: mortalitySum.female.map((m) =>
            mortalityYears > 0 ? m / mortalityYears : 0
        ),
        male: mortalitySum.male.map((m) =>
            mortalityYears > 0 ? m / mortalityYears : 0
        ),
    }
    const migrationRate = migrationSum / numYears

    const tfr = calculateTFR(fertility)
    const avgMortality = mortality.female.map(
        (f, i) => (f + mortality.male[i]) / 2
    )
    const lifeExpectancy = calculateLifeExpectancy(avgMortality)

    return { fertility, mortality, migrationRate, tfr, lifeExpectancy }
}

// -- Scaling --

export function scaleFertilityToTFR(
    baselineFertility: number[],
    baseTFR: number,
    targetTFR: number
): number[] {
    if (baseTFR === 0) return baselineFertility
    const scaleFactor = targetTFR / baseTFR
    return baselineFertility.map((rate) => rate * scaleFactor)
}

export function scaleMortalityToLE(
    baselineMortality: { female: number[]; male: number[] },
    baseLE: number,
    targetLE: number
): { female: number[]; male: number[] } {
    function buildAgePattern(sex: string): number[] {
        const pattern = new Array(MAX_AGE + 1).fill(1)
        for (let age = 0; age <= MAX_AGE; age++) {
            let exponent = 1
            if (age === 0) exponent = 1.35
            else if (age <= 14) exponent = 1.15
            else if (age <= 39) exponent = 1.0
            else if (age <= 64) exponent = 0.92
            else if (age <= 84) exponent = 0.82
            else exponent = 0.72

            if (sex === "male") exponent *= 1.05
            pattern[age] = exponent
        }
        return pattern
    }

    const femalePattern = buildAgePattern("female")
    const malePattern = buildAgePattern("male")

    function scaleAndClose(
        rates: number[],
        sex: string,
        scale: number
    ): number[] {
        const pattern = sex === "female" ? femalePattern : malePattern
        const scaled = rates.map((rate, age) =>
            Math.min(rate * Math.pow(scale, pattern[age]), 1)
        )
        return applyOldAgeClosure(scaled, sex)
    }

    function findScaleForSex(
        rates: number[],
        sex: string,
        targetSexLE: number
    ): number[] {
        let lo = 0.01
        let hi = 5.0
        let bestRates = scaleAndClose(rates, sex, 1)
        let bestDiff = Math.abs(
            calculateLifeExpectancy(bestRates) - targetSexLE
        )

        for (let i = 0; i < 50; i++) {
            const mid = (lo + hi) / 2
            const scaled = scaleAndClose(rates, sex, mid)
            const le = calculateLifeExpectancy(scaled)
            const diff = Math.abs(le - targetSexLE)
            if (diff < bestDiff) {
                bestDiff = diff
                bestRates = scaled
            }
            if (diff < 0.1) return scaled

            if (le < targetSexLE) {
                hi = mid
            } else {
                lo = mid
            }
        }

        return bestRates
    }

    if (Math.abs(targetLE - baseLE) < 0.1) {
        return {
            female: scaleAndClose(baselineMortality.female, "female", 1),
            male: scaleAndClose(baselineMortality.male, "male", 1),
        }
    }

    const femaleBaseLE = calculateLifeExpectancy(
        scaleAndClose(baselineMortality.female, "female", 1)
    )
    const maleBaseLE = calculateLifeExpectancy(
        scaleAndClose(baselineMortality.male, "male", 1)
    )
    const baselineGap = femaleBaseLE - maleBaseLE
    const targetFemaleLE = targetLE + baselineGap / 2
    const targetMaleLE = targetLE - baselineGap / 2

    return {
        female: findScaleForSex(
            baselineMortality.female,
            "female",
            targetFemaleLE
        ),
        male: findScaleForSex(baselineMortality.male, "male", targetMaleLE),
    }
}

// -- Future projection --

export function runFutureProjection(
    startPopulation: PopulationBySex,
    startYear: number,
    endYear: number,
    params: {
        fertilityRates: number[]
        mortalityRates: { female: number[]; male: number[] }
        migrationRate: number
    },
    options: { migrationOptions?: MigrationOptions } = {}
): Record<number, YearResult> {
    const { fertilityRates, mortalityRates, migrationRate } = params
    const migrationOptions = options.migrationOptions || activeMigrationOptions
    const results: Record<number, YearResult> = {}

    let population = clonePopulation(startPopulation)
    results[startYear] = {
        population: clonePopulation(population),
        totalPop: getTotalPopulationFromArrays(
            population.female,
            population.male
        ),
    }

    for (let year = startYear; year < endYear; year++) {
        population = simulateYear(
            population,
            mortalityRates,
            fertilityRates,
            migrationRate,
            migrationOptions
        )
        results[year + 1] = {
            population: clonePopulation(population),
            totalPop: getTotalPopulationFromArrays(
                population.female,
                population.male
            ),
        }
    }

    return results
}

// -- UN WPP scenario projection --

export function runUNWPPScenarioProjection(
    data: CountryData,
    startPopulation: PopulationBySex,
    startYear: number,
    endYear: number,
    options: { migrationOptions?: MigrationOptions } = {}
): Record<number, YearResult> {
    const results: Record<number, YearResult> = {}
    const migrationOptions = options.migrationOptions || activeMigrationOptions

    let population = clonePopulation(startPopulation)
    results[startYear] = {
        population: clonePopulation(population),
        totalPop: getTotalPopulationFromArrays(
            population.female,
            population.male
        ),
    }

    for (let year = startYear; year < endYear; year++) {
        let scenarioYear = year
        let fertility = getProjectionFertilityForYear(data, scenarioYear)
        let deaths = getProjectionDeathsForYear(data, scenarioYear)
        let migrationRate = getProjectionMigrationRateForYear(
            data,
            scenarioYear
        )

        if ((!fertility || !deaths) && scenarioYear + 1 <= endYear) {
            scenarioYear += 1
            fertility = getProjectionFertilityForYear(data, scenarioYear)
            deaths = getProjectionDeathsForYear(data, scenarioYear)
            migrationRate = getProjectionMigrationRateForYear(
                data,
                scenarioYear
            )
        }

        if (!fertility || !deaths) {
            console.warn(`Missing UN WPP scenario data for year ${year}`)
            results[year + 1] = {
                population: clonePopulation(population),
                totalPop: getTotalPopulationFromArrays(
                    population.female,
                    population.male
                ),
            }
            continue
        }

        const projectedExposurePopulation = getProjectionPopulationForYear(
            data,
            scenarioYear
        )
        const exposurePopulation = projectedExposurePopulation || population
        const mortalityRates = calculateMortalityRates(
            deaths,
            exposurePopulation.female,
            exposurePopulation.male
        )

        population = simulateYear(
            population,
            mortalityRates,
            fertility,
            migrationRate,
            migrationOptions
        )

        results[year + 1] = {
            population: clonePopulation(population),
            totalPop: getTotalPopulationFromArrays(
                population.female,
                population.male
            ),
        }
    }

    return results
}

// -- Migration optimization --

function hasCompleteAgeGroupRow(
    row: Record<string, number> | undefined,
    ageGroups: string[]
): boolean {
    if (!row) return false
    for (const ageGroup of ageGroups) {
        if (!isFiniteNumber(row[ageGroup])) return false
    }
    return true
}

function getStrongMigrationCalibrationYears(
    data: CountryData,
    startYear: number,
    endYear: number
): number[] {
    const years: number[] = []

    for (let year = startYear; year <= endYear; year++) {
        const pop = getPopulationForYear(data, year)
        const nextPop = getPopulationForYear(data, year + 1)
        if (!pop || !nextPop) continue

        const fertRow = data.fertility?.[year]
        const femaleDeathsRow = data.deaths?.female?.[year]
        const maleDeathsRow = data.deaths?.male?.[year]
        const migrationRate = data.migration?.[year]?.net_migration_rate

        if (!hasCompleteAgeGroupRow(fertRow, FERTILITY_AGE_GROUPS)) continue
        if (!hasCompleteAgeGroupRow(femaleDeathsRow, OWID_AGE_GROUPS)) continue
        if (!hasCompleteAgeGroupRow(maleDeathsRow, OWID_AGE_GROUPS)) continue
        if (!isFiniteNumber(migrationRate)) continue

        years.push(year)
    }

    return years
}

function getAverageNetMigrationRate(
    data: CountryData,
    years: number[]
): number {
    let sum = 0
    let count = 0
    for (const year of years) {
        const rate = data.migration?.[year]?.net_migration_rate
        if (!isFiniteNumber(rate)) continue
        sum += Number(rate)
        count += 1
    }
    return count > 0 ? sum / count : 0
}

function getPooledMigrationDefaultsForCountry(
    data: CountryData,
    strongYears: number[]
): MigrationOptions {
    const years =
        strongYears.length > 0
            ? strongYears
            : Object.keys(data.migration || {})
                  .map((y) => Number(y))
                  .filter((y) => Number.isFinite(y))
    const avgRate = getAverageNetMigrationRate(data, years)

    if (avgRate >= 1) {
        return {
            ...DEFAULT_MIGRATION_OPTIONS,
            ...POOLED_MIGRATION_DEFAULTS_BY_REGIME.receiving,
        }
    }
    if (avgRate <= -1) {
        return {
            ...DEFAULT_MIGRATION_OPTIONS,
            ...POOLED_MIGRATION_DEFAULTS_BY_REGIME.sending,
        }
    }
    return {
        ...DEFAULT_MIGRATION_OPTIONS,
        ...POOLED_MIGRATION_DEFAULTS_BY_REGIME.balanced,
    }
}

function evaluateMigrationOptionsOneStep(
    data: CountryData,
    years: number[],
    migrationOptions: MigrationOptions
): number {
    let absPctSum = 0
    let count = 0

    for (const year of years) {
        const pop = getPopulationForYear(data, year)
        const nextPop = getPopulationForYear(data, year + 1)
        const deaths = getDeathsForYear(data, year)
        const fertility = getFertilityForYear(data, year)
        const migrationRate = getMigrationRateForYear(data, year)

        if (
            !pop ||
            !nextPop ||
            !deaths ||
            !fertility ||
            !isFiniteNumber(migrationRate)
        )
            continue

        const mortality = calculateMortalityRates(deaths, pop.female, pop.male)
        const predictedNext = simulateYear(
            pop,
            mortality,
            fertility,
            migrationRate,
            migrationOptions
        )
        const predictedTotal = getTotalPopulationFromArrays(
            predictedNext.female,
            predictedNext.male
        )
        const actualTotal = getTotalPopulation(nextPop)
        if (!isFiniteNumber(actualTotal) || actualTotal <= 0) continue

        absPctSum += Math.abs(
            ((predictedTotal - actualTotal) / actualTotal) * 100
        )
        count += 1
    }

    if (count === 0) return Infinity
    return absPctSum / count
}

function evaluateMigrationOptionsCumulative(
    data: CountryData,
    years: number[],
    migrationOptions: MigrationOptions
): { mape: number; endAbsPct: number } {
    if (!years || years.length === 0)
        return { mape: Infinity, endAbsPct: Infinity }

    const sorted = [...years].sort((a, b) => a - b)
    const startYear = sorted[0]
    const endYear = sorted[sorted.length - 1] + 1
    const simulated = runHistoricalProjection(data, startYear, endYear, {
        migrationOptions,
    })

    let absPctSum = 0
    let count = 0
    let endAbsPct = Infinity

    for (let year = startYear; year <= endYear; year++) {
        const actualPop = getPopulationForYear(data, year)
        const actualTotal = actualPop ? getTotalPopulation(actualPop) : null
        const modeledTotal = simulated[year]?.totalPop
        if (
            !isFiniteNumber(actualTotal) ||
            !isFiniteNumber(modeledTotal) ||
            actualTotal <= 0
        )
            continue

        const absPct = Math.abs(
            ((modeledTotal - actualTotal) / actualTotal) * 100
        )
        absPctSum += absPct
        count += 1
        if (year === endYear) endAbsPct = absPct
    }

    return {
        mape: count > 0 ? absPctSum / count : Infinity,
        endAbsPct,
    }
}

function evaluateMigrationOptionsUNProjection(
    data: CountryData,
    migrationOptions: MigrationOptions
): { mape: number | null; endAbsPct: number | null } {
    const projectionYears = Object.keys(data.projection?.female || {})
        .map((year) => Number(year))
        .filter((year) => Number.isFinite(year))
        .sort((a, b) => a - b)

    if (projectionYears.length === 0) return { mape: null, endAbsPct: null }

    const firstProjectionYear = projectionYears[0]
    const lastProjectionYear = projectionYears[projectionYears.length - 1]
    const startYear = firstProjectionYear - 1
    const startPopulation = getPopulationForYear(data, startYear)

    if (!startPopulation) return { mape: null, endAbsPct: null }

    const simulated = runUNWPPScenarioProjection(
        data,
        startPopulation,
        startYear,
        lastProjectionYear,
        { migrationOptions }
    )

    let absPctSum = 0
    let count = 0
    let endAbsPct = Infinity

    for (const year of projectionYears) {
        const projectedPopulation = getProjectionPopulationForYear(data, year)
        const projectedTotal = projectedPopulation
            ? getTotalPopulation(projectedPopulation)
            : null
        const modeledTotal = simulated[year]?.totalPop
        if (
            !isFiniteNumber(projectedTotal) ||
            !isFiniteNumber(modeledTotal) ||
            projectedTotal <= 0
        )
            continue

        const absPct = Math.abs(
            ((modeledTotal - projectedTotal) / projectedTotal) * 100
        )
        absPctSum += absPct
        count += 1
        if (year === lastProjectionYear) endAbsPct = absPct
    }

    return {
        mape: count > 0 ? absPctSum / count : null,
        endAbsPct: count > 0 ? endAbsPct : null,
    }
}

export interface OptimizationResult {
    options: MigrationOptions
    source: string
    isDataSparse: boolean
    strongYears: number[]
    optimizationMape: number | null
}

export function optimizeMigrationOptions(
    data: CountryData,
    country: string,
    startYear: number | undefined,
    endYear: number | undefined,
    config: {
        minStrongYears?: number
        schedules?: string[]
        directions?: string[]
        sexPatterns?: string[]
        flowTurnoverRates?: number[]
    } = {}
): OptimizationResult {
    const effectiveEndYear = Number.isFinite(endYear) ? endYear! : 2023
    const effectiveStartYear = Number.isFinite(startYear)
        ? startYear!
        : Math.max(
              1950,
              effectiveEndYear - DEFAULT_MIGRATION_OPTIMIZATION_YEARS + 1
          )
    const minStrongYears =
        Number(config.minStrongYears) ||
        MIN_STRONG_YEARS_FOR_COUNTRY_OPTIMIZATION

    const strongYears = getStrongMigrationCalibrationYears(
        data,
        effectiveStartYear,
        effectiveEndYear
    )
    const externalPrior = getExternalSexSharePrior(country)
    const pooledDefaults = getPooledMigrationDefaultsForCountry(
        data,
        strongYears
    )
    const pooledWithPrior: MigrationOptions = {
        ...pooledDefaults,
        ...(externalPrior
            ? {
                  immigrationMaleSharePrior: externalPrior.immigrationMaleShare,
                  emigrationMaleSharePrior: externalPrior.emigrationMaleShare,
              }
            : {}),
    }

    if (strongYears.length < minStrongYears) {
        return {
            options: pooledWithPrior,
            source: "pooled-high-quality-defaults",
            isDataSparse: true,
            strongYears,
            optimizationMape: null,
        }
    }

    const hasExternalPrior = !!externalPrior
    const defaultCandidateGrid = {
        schedules: ["western_standard", "low_dependency"],
        directions: hasExternalPrior
            ? ["auto", "receiving", "sending"]
            : ["auto"],
        sexPatterns: hasExternalPrior
            ? ["neutral", "younger_male", "younger_female"]
            : ["neutral"],
        flowTurnoverRates: hasExternalPrior
            ? [0, 0.001, 0.0025, 0.005, 0.01]
            : [0, 0.001, 0.0025, 0.005],
    }

    let bestScore = Infinity
    let bestOptions = pooledWithPrior
    let bestDiagnostics: { cumulativeMape: number } | null = null
    let bestWesternScore = Infinity
    let bestWesternOptions: MigrationOptions | null = null
    let bestWesternDiagnostics: { cumulativeMape: number } | null = null

    const schedules = config.schedules || defaultCandidateGrid.schedules
    const directions = config.directions || defaultCandidateGrid.directions
    const sexPatterns = config.sexPatterns || defaultCandidateGrid.sexPatterns
    const flowTurnoverRates =
        config.flowTurnoverRates || defaultCandidateGrid.flowTurnoverRates

    const baselineOneStep = evaluateMigrationOptionsOneStep(
        data,
        strongYears,
        pooledWithPrior
    )
    const baselineCumulative = evaluateMigrationOptionsCumulative(
        data,
        strongYears,
        pooledWithPrior
    )
    const baselineUN = evaluateMigrationOptionsUNProjection(
        data,
        pooledWithPrior
    )
    const baselineUNMape = isFiniteNumber(baselineUN.mape) ? baselineUN.mape : 0
    const baselineUNEndAbsPct = isFiniteNumber(baselineUN.endAbsPct)
        ? baselineUN.endAbsPct
        : 0
    const baselineScore =
        baselineOneStep +
        MIGRATION_OPTIMIZATION_WEIGHTS.cumulativeMape *
            baselineCumulative.mape +
        MIGRATION_OPTIMIZATION_WEIGHTS.cumulativeEndAbsPct *
            baselineCumulative.endAbsPct +
        MIGRATION_OPTIMIZATION_WEIGHTS.unMape * baselineUNMape +
        MIGRATION_OPTIMIZATION_WEIGHTS.unEndAbsPct * baselineUNEndAbsPct

    for (const schedule of schedules) {
        for (const direction of directions) {
            for (const sexPattern of sexPatterns) {
                for (const flowTurnoverRate of flowTurnoverRates) {
                    const candidate: MigrationOptions = {
                        ...DEFAULT_MIGRATION_OPTIONS,
                        ...pooledWithPrior,
                        schedule,
                        direction,
                        sexPattern,
                        flowTurnoverRate,
                    }
                    const oneStepScore = evaluateMigrationOptionsOneStep(
                        data,
                        strongYears,
                        candidate
                    )
                    const cumulativeScore = evaluateMigrationOptionsCumulative(
                        data,
                        strongYears,
                        candidate
                    )
                    const unProjectionScore =
                        evaluateMigrationOptionsUNProjection(data, candidate)
                    const unMapeScore = isFiniteNumber(unProjectionScore.mape)
                        ? unProjectionScore.mape
                        : 0
                    const unEndAbsPctScore = isFiniteNumber(
                        unProjectionScore.endAbsPct
                    )
                        ? unProjectionScore.endAbsPct
                        : 0
                    const regularization =
                        (schedule === "western_standard" ? 0 : 0.12) +
                        (direction === "auto" ? 0 : 0.08) +
                        (sexPattern === "neutral" ? 0 : 0.1) +
                        flowTurnoverRate * 8
                    const score =
                        MIGRATION_OPTIMIZATION_WEIGHTS.oneStep * oneStepScore +
                        MIGRATION_OPTIMIZATION_WEIGHTS.cumulativeMape *
                            cumulativeScore.mape +
                        MIGRATION_OPTIMIZATION_WEIGHTS.cumulativeEndAbsPct *
                            cumulativeScore.endAbsPct +
                        MIGRATION_OPTIMIZATION_WEIGHTS.unMape * unMapeScore +
                        MIGRATION_OPTIMIZATION_WEIGHTS.unEndAbsPct *
                            unEndAbsPctScore +
                        regularization
                    if (score < bestScore) {
                        bestScore = score
                        bestOptions = candidate
                        bestDiagnostics = {
                            cumulativeMape: cumulativeScore.mape,
                        }
                    }
                    if (
                        schedule === "western_standard" &&
                        score < bestWesternScore
                    ) {
                        bestWesternScore = score
                        bestWesternOptions = candidate
                        bestWesternDiagnostics = {
                            cumulativeMape: cumulativeScore.mape,
                        }
                    }
                }
            }
        }
    }

    if (
        bestOptions.schedule !== "western_standard" &&
        bestWesternOptions &&
        !(bestScore + SCHEDULE_SWITCH_MIN_IMPROVEMENT < bestWesternScore)
    ) {
        bestScore = bestWesternScore
        bestOptions = bestWesternOptions
        bestDiagnostics = bestWesternDiagnostics
    }

    if (!(bestScore + MIN_OPTIMIZATION_IMPROVEMENT < baselineScore)) {
        return {
            options: pooledWithPrior,
            source: "pooled-high-quality-defaults",
            isDataSparse: false,
            strongYears,
            optimizationMape: baselineCumulative.mape,
        }
    }

    return {
        options: bestOptions,
        source: "optimized-balanced-window",
        isDataSparse: false,
        strongYears,
        optimizationMape: bestDiagnostics?.cumulativeMape ?? null,
    }
}

// -- Migration options state --

export function setMigrationOptions(
    partialOptions: Partial<MigrationOptions> = {}
) {
    const merged: MigrationOptions = {
        ...activeMigrationOptions,
        ...partialOptions,
    }

    if (!MIGRATION_BASE_AGE_WEIGHTS[merged.schedule]) {
        merged.schedule = DEFAULT_MIGRATION_OPTIONS.schedule
    }
    if (!["auto", "receiving", "sending"].includes(merged.direction)) {
        merged.direction = DEFAULT_MIGRATION_OPTIONS.direction
    }
    if (
        !["neutral", "younger_male", "younger_female"].includes(
            merged.sexPattern
        )
    ) {
        merged.sexPattern = DEFAULT_MIGRATION_OPTIONS.sexPattern
    }

    merged.flowTurnoverRate = Math.max(
        0,
        Number(merged.flowTurnoverRate) ||
            DEFAULT_MIGRATION_OPTIONS.flowTurnoverRate
    )
    merged.externalSexShareBlend = clamp(
        Number(
            merged.externalSexShareBlend ??
                DEFAULT_MIGRATION_OPTIONS.externalSexShareBlend
        ),
        0,
        1
    )
    merged.immigrationMaleSharePrior = isFiniteNumber(
        merged.immigrationMaleSharePrior
    )
        ? clamp(Number(merged.immigrationMaleSharePrior), 0.1, 0.9)
        : null
    merged.emigrationMaleSharePrior = isFiniteNumber(
        merged.emigrationMaleSharePrior
    )
        ? clamp(Number(merged.emigrationMaleSharePrior), 0.1, 0.9)
        : null
    merged.oldAgeNetMigrationCutoff = Math.max(
        0,
        Math.min(
            MAX_AGE,
            Math.round(
                Number(merged.oldAgeNetMigrationCutoff) ||
                    DEFAULT_MIGRATION_OPTIONS.oldAgeNetMigrationCutoff
            )
        )
    )

    activeMigrationOptions = merged
}

export function getMigrationOptions(): MigrationOptions {
    return { ...activeMigrationOptions }
}
