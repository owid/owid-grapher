import { createRoot } from "react-dom/client"
import { enableShadowDOM } from "@react-stately/flags"

import { COLOR_SCHEMES, VariantName } from "./core/constants.js"
import { ScatterVariant } from "./variants/ScatterVariant.js"

import type {
    BespokeComponentMountFn,
    BespokeComponentMountOpts,
    BespokeComponentVariantsList,
    BespokeConfigSpec,
} from "owid-bespoke-types"
import StylesTarget from "vite-plugin-css-position/react"

import { ConfigFromSpec, parseConfigFromSpec } from "../../../helpers/config.js"

import "./index.scss"

// Enable react-aria's internal Shadow DOM handling paths.
// Must be called before any react-aria components render.
enableShadowDOM()

export const VARIANTS = [
    {
        name: "scatter",
        description:
            "Training computation of notable AI models over time, with a zoomable time range, colors by developer, domain or sector, and famous computers for comparison",
        component: ScatterVariant,
    },
] satisfies BespokeComponentVariantsList<VariantName>

export const CONFIG_SPEC = {
    title: {
        type: "string",
        default: "How much computation was used to train notable AI systems?",
        description: "Chart title",
    },
    subtitle: {
        type: "string",
        default:
            "Total number of calculations (floating-point operations, FLOP) used to train each AI system. The axis is logarithmic: each labeled gridline is a thousand times the one below.",
        description: "Chart subtitle",
    },
    colorBy: {
        type: "enum",
        values: COLOR_SCHEMES,
        default: "organization",
        description:
            "What the dot colors show at first: the developer, the domain of the AI system, or the sector (industry or academia)",
    },
    startYear: {
        type: "integer",
        default: "1940",
        description: "First year of the time range shown at first",
    },
    endYear: {
        type: "integer",
        description:
            "Last year of the time range shown at first. Defaults to next year",
    },
    showComputers: {
        type: "boolean",
        default: "true",
        description:
            "Whether famous computers (supercomputers, PCs and consoles, AI chips) start switched on",
    },
    showReferenceLines: {
        type: "boolean",
        default: "true",
        description:
            "Whether the human comparisons and legal thresholds start switched on",
    },
    labeledModels: {
        type: "string",
        default:
            "GPT-6 Astra, AlexNet, GPT-3 175B (davinci), AlphaGo Lee, Theseus, Perceptron Mark I, TD-Gammon, AlphaFold 2, GPT-4 (Mar 2023), NetTalk (transcription), Neocognitron, ADALINE, GraphCast",
        description:
            "Comma-separated model names (as in Epoch's data) to label directly on the chart, most important first",
    },
    hideControls: {
        type: "boolean",
        default: "false",
        description: "Hide the controls box above the chart",
    },
} as const satisfies BespokeConfigSpec

export type AiTrainingComputeConfig = ConfigFromSpec<typeof CONFIG_SPEC>

export const mount: BespokeComponentMountFn = (
    container: HTMLDivElement,
    opts: BespokeComponentMountOpts
) => {
    const variant = VARIANTS.find((v) => v.name === opts.variant)
    if (!variant) {
        container.textContent = `Unknown variant: "${opts.variant}"`
        return
    }

    const config = parseConfigFromSpec(CONFIG_SPEC, opts.config ?? {})

    const root = createRoot(container)
    root.render(
        <>
            {/* Vite-injected styles land here, inside the Shadow DOM */}
            <StylesTarget />
            <variant.component config={config} />
        </>
    )
    return () => root.unmount()
}
