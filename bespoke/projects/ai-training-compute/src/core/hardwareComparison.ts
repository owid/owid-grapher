import { AiModel } from "./constants.js"
import { ComputerSystem, getMonthOfComputation } from "./computers.js"

const CONSUMER_KINDS = new Set(["pcCpu", "console", "gpu"])
// Consoles count when they're passed in; the chart currently leaves them out

/**
 * How many months of the fastest consumer machine (PC processor, games
 * console or graphics card) released by `year` the largest training run up
 * to `year` would have taken. Around 1 or below means a top home computer
 * could have done the job in a month.
 */
export function getLargestRunInDeviceMonths(
    year: number,
    models: AiModel[],
    computers: ComputerSystem[]
): { months: number; model: AiModel; device: ComputerSystem } | undefined {
    const model = models
        .filter((m) => m.year < year + 1)
        .reduce<AiModel | undefined>(
            (best, m) =>
                !best || m.trainingComputeFlop > best.trainingComputeFlop
                    ? m
                    : best,
            undefined
        )
    const device = computers
        .filter((c) => CONSUMER_KINDS.has(c.kind) && c.year <= year)
        .reduce<ComputerSystem | undefined>(
            (best, c) =>
                !best || c.flopPerSecond > best.flopPerSecond ? c : best,
            undefined
        )
    if (!model || !device) return undefined
    return {
        months: model.trainingComputeFlop / getMonthOfComputation(device),
        model,
        device,
    }
}
