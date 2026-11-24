import { SECONDS_PER_MONTH } from "./constants.js"

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

export type ComputerKind = "supercomputer" | "personal" | "aiChip"

export interface ComputerSystem {
    id: string
    name: string
    kind: ComputerKind
    year: number
    /** Operations per second */
    flopPerSecond: number
    description: string
}

export const COMPUTER_KIND_LABELS: Record<ComputerKind, string> = {
    supercomputer: "Supercomputer",
    personal: "Personal computer or console",
    aiChip: "AI chip",
}

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

    // Personal computers and consoles
    {
        id: "ibm-pc",
        name: "IBM PC",
        kind: "personal",
        year: 1981,
        flopPerSecond: 50e3,
        description:
            "With its optional Intel 8087 math coprocessor, the original IBM PC managed about 50,000 FLOP per second.",
    },
    {
        id: "playstation-2",
        name: "PlayStation 2",
        kind: "personal",
        year: 2000,
        flopPerSecond: 6.2e9,
        description:
            "Sony's best-selling console peaked at about 6.2 billion FLOP per second.",
    },
    {
        id: "xbox-360",
        name: "Xbox 360",
        kind: "personal",
        year: 2005,
        flopPerSecond: 240e9,
        description:
            "Its graphics chip peaked at about 240 billion FLOP per second.",
    },
    {
        id: "playstation-5",
        name: "PlayStation 5",
        kind: "personal",
        year: 2020,
        flopPerSecond: 10.28e12,
        description:
            "Its graphics chip peaks at about 10.3 trillion FLOP per second (32-bit).",
    },
    {
        id: "macbook-air-m2",
        name: "MacBook Air (M2)",
        kind: "personal",
        year: 2022,
        flopPerSecond: 3.6e12,
        description:
            "The 10-core GPU of Apple's M2 chip peaks at about 3.6 trillion FLOP per second (32-bit).",
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
]

export function getMonthOfComputation(system: ComputerSystem): number {
    return system.flopPerSecond * SECONDS_PER_MONTH
}
