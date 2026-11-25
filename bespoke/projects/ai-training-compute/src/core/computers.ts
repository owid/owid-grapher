import consumerHardware from "../data/consumerHardware.json"

import { SECONDS_PER_MONTH } from "./constants.js"
import { formatFlopInWords } from "./formatFlop.js"

/**
 * Famous computers, drawn at the year they were introduced, at the
 * computation they would do running flat out for one month. That puts them on
 * the same scale as a training run, which is also a single total.
 *
 * Speeds aren't strictly like for like. Supercomputers are measured at
 * 64-bit precision on the LINPACK benchmark (their TOP500 "Rmax"); consumer
 * and AI chips are rated at their peak, and AI chips at the 16-bit precision
 * used to train models. Each entry notes which.
 */

export type ComputerKind =
    | "supercomputer"
    | "pcCpu"
    | "console"
    | "gpu"
    | "aiChip"

export interface ComputerSystem {
    id: string
    name: string
    /** Shorter name for the chart label; the tooltip keeps `name` */
    label?: string
    kind: ComputerKind
    year: number
    /** Operations per second */
    flopPerSecond: number
    description: string
}

export const COMPUTER_KIND_LABELS: Record<ComputerKind, string> = {
    supercomputer: "Supercomputer",
    pcCpu: "PC processor",
    console: "Games console",
    gpu: "PC graphics card",
    aiChip: "AI chip",
}

/** One row of src/data/consumerHardware.json, from scripts/consumerHardware.csv */
interface RawConsumerHardware {
    id: string
    name: string
    kind: "pc_cpu" | "console" | "gpu"
    year: number
    flopPerSecond: number
    precision: string
    sourceUrl: string
    notes: string
}

const CONSUMER_KINDS: Record<RawConsumerHardware["kind"], ComputerKind> = {
    pc_cpu: "pcCpu",
    console: "console",
    gpu: "gpu",
}

/** PC processors, games consoles and graphics cards at their peak speed */
const CONSUMER_HARDWARE: ComputerSystem[] = (
    consumerHardware as RawConsumerHardware[]
).map((row) => ({
    id: row.id,
    name: row.name,
    // "IBM PC 5150 with Intel 8087 coprocessor" → "IBM PC 5150",
    // "Intel Core i7-920 (Bloomfield)" → "Intel Core i7-920"
    label: row.name.replace(/ \(.*?\)/g, "").replace(/ with .*/, ""),
    kind: CONSUMER_KINDS[row.kind],
    year: row.year,
    flopPerSecond: row.flopPerSecond,
    description: `Peaks at about ${formatFlopInWords(row.flopPerSecond)} FLOP per second (${row.precision}).`,
}))

export const COMPUTER_SYSTEMS: ComputerSystem[] = [
    // Supercomputers
    {
        id: "eniac",
        name: "ENIAC",
        kind: "supercomputer",
        year: 1945,
        flopPerSecond: 5e3,
        description:
            "The first general-purpose electronic computer, doing about 5,000 additions per second.",
    },
    {
        id: "univac-1",
        name: "UNIVAC I",
        kind: "supercomputer",
        year: 1951,
        flopPerSecond: 1.9e3,
        description:
            "The first commercial computer in the US, at about 1,900 operations per second.",
    },
    {
        id: "cdc-6600",
        name: "CDC 6600",
        kind: "supercomputer",
        year: 1964,
        flopPerSecond: 3e6,
        description:
            "Often called the first supercomputer, at about 3 million FLOP per second.",
    },
    {
        id: "cray-1",
        name: "Cray-1",
        kind: "supercomputer",
        year: 1976,
        flopPerSecond: 160e6,
        description: "Peaked at about 160 million FLOP per second.",
    },
    {
        id: "cray-2",
        name: "Cray-2",
        kind: "supercomputer",
        year: 1985,
        flopPerSecond: 1.9e9,
        description:
            "The first computer to pass a billion FLOP per second (1.9 billion at peak).",
    },
    {
        id: "asci-red",
        name: "ASCI Red",
        kind: "supercomputer",
        year: 1997,
        flopPerSecond: 1.068e12,
        description:
            "The first computer to pass a trillion FLOP per second on the LINPACK benchmark.",
    },
    {
        id: "earth-simulator",
        name: "Earth Simulator",
        kind: "supercomputer",
        year: 2002,
        flopPerSecond: 35.86e12,
        description:
            "Japan's climate-modeling machine, the world's fastest from 2002 to 2004 at 36 trillion FLOP per second (LINPACK).",
    },
    {
        id: "roadrunner",
        name: "Roadrunner",
        kind: "supercomputer",
        year: 2008,
        flopPerSecond: 1.026e15,
        description:
            "The first computer to pass a quadrillion FLOP per second on the LINPACK benchmark.",
    },
    {
        id: "tianhe-2",
        name: "Tianhe-2",
        kind: "supercomputer",
        year: 2013,
        flopPerSecond: 33.86e15,
        description:
            "China's supercomputer, the world's fastest from 2013 to 2016 at 34 quadrillion FLOP per second (LINPACK).",
    },
    {
        id: "summit",
        name: "Summit",
        kind: "supercomputer",
        year: 2018,
        flopPerSecond: 122.3e15,
        description:
            "Oak Ridge's GPU-based supercomputer, measured at 122 quadrillion FLOP per second (LINPACK) when it debuted at the top of the TOP500 list.",
    },
    {
        id: "frontier",
        name: "Frontier",
        kind: "supercomputer",
        year: 2022,
        flopPerSecond: 1.102e18,
        description:
            "The first computer to pass a quintillion FLOP per second (exascale) on the LINPACK benchmark.",
    },
    {
        id: "el-capitan",
        name: "El Capitan",
        kind: "supercomputer",
        year: 2024,
        flopPerSecond: 1.742e18,
        description:
            "The world's fastest supercomputer on the TOP500 list since November 2024, measured at 1.74 quintillion FLOP per second (LINPACK) at its debut.",
    },

    // A laptop's graphics, which the sourced consumer table doesn't cover
    {
        id: "macbook-pro-m5",
        name: "MacBook Pro (M5)",
        kind: "gpu",
        year: 2025,
        // Rough estimate: Apple publishes no 32-bit figure for the M5 GPU
        flopPerSecond: 4.5e12,
        description:
            "Apple doesn't publish a 32-bit speed for the 10-core GPU of its M5 chip; about 4.5 trillion FLOP per second is a rough estimate scaled from earlier M-series chips.",
    },

    // AI chips
    {
        id: "v100",
        name: "Nvidia V100",
        kind: "aiChip",
        year: 2017,
        flopPerSecond: 125e12,
        description:
            'Nvidia\'s first chip with dedicated AI "tensor cores", peaking at 125 trillion FLOP per second (16-bit).',
    },
    {
        id: "a100",
        name: "Nvidia A100",
        kind: "aiChip",
        year: 2020,
        flopPerSecond: 312e12,
        description:
            "Used to train GPT-4 and many other models of its time; 312 trillion FLOP per second at peak (16-bit).",
    },
    {
        id: "h100",
        name: "Nvidia H100",
        kind: "aiChip",
        year: 2022,
        flopPerSecond: 989e12,
        description:
            "The workhorse of AI training from 2023; 989 trillion FLOP per second at peak (16-bit).",
    },
    {
        id: "b200",
        name: "Nvidia B200",
        kind: "aiChip",
        year: 2024,
        flopPerSecond: 2.25e15,
        description:
            "Nvidia's Blackwell chip; 2.25 quadrillion FLOP per second at peak (16-bit, dense).",
    },
    ...CONSUMER_HARDWARE,
]

export function getMonthOfComputation(system: ComputerSystem): number {
    return system.flopPerSecond * SECONDS_PER_MONTH
}

/**
 * The computers the chart shows. Left out for now: supercomputers, whose
 * 64-bit benchmark speeds don't compare cleanly with the peak ratings of
 * the other machines, and games consoles, which crowd the chart without
 * changing the trend PC processors and graphics cards already show.
 */
export const SHOWN_COMPUTERS = COMPUTER_SYSTEMS.filter(
    (c) => c.kind !== "supercomputer" && c.kind !== "console"
)

/**
 * The machines that were faster than every earlier one of their kind, in
 * year order: the trend line for each kind runs through these, so a slower
 * machine released later (a handheld console, say) doesn't make it zigzag
 */
export function getRecordHolders(systems: ComputerSystem[]): ComputerSystem[] {
    const byKind = new Map<ComputerKind, number>()
    return [...systems]
        .sort((a, b) => a.year - b.year || b.flopPerSecond - a.flopPerSecond)
        .filter((system) => {
            const best = byKind.get(system.kind) ?? 0
            if (system.flopPerSecond <= best) return false
            byKind.set(system.kind, system.flopPerSecond)
            return true
        })
}
