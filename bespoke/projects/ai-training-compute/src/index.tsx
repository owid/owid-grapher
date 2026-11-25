import { createRoot } from "react-dom/client"
import { enableShadowDOM } from "@react-stately/flags"

import { VariantName } from "./core/constants.js"
import { ScatterVariant } from "./variants/ScatterVariant.js"
import { TutorialVariant } from "./variants/TutorialVariant.js"

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
            "Training computation of notable AI models over time, colored by developer, with a zoomable time range",
        component: ScatterVariant,
    },
    {
        name: "tutorial",
        description:
            "The same chart with guided walkthroughs beside it, played slide by slide: missing frontier models, uncertainty, familiar computers and legal thresholds",
        component: TutorialVariant,
        defaultSize: "widest",
    },
] satisfies BespokeComponentVariantsList<VariantName>

export const CONFIG_SPEC = {
    title: {
        type: "string",
        default: "How much computation was used to train AI systems?",
        description: "Chart title",
    },
    subtitle: {
        type: "string",
        default:
            "Total number of calculations (floating-point operations, FLOP) used to train each AI system.",
        description:
            "Chart subtitle. A sentence on frontier models missing since 2024, with a link that zooms to them, is always appended",
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
    labeledModels: {
        type: "string",
        default:
            "GPT-6 Astra, AlexNet, GPT-3 175B (davinci), AlphaGo Lee, Theseus, Perceptron Mark I, TD-Gammon, AlphaFold 2, GPT-4 (Mar 2023), NetTalk (transcription), Neocognitron, ADALINE, GraphCast",
        description:
            "Comma-separated model names (as in Epoch's data) to label directly on the chart, most important first",
    },
    walkthrough: {
        type: "string",
        description:
            "Tutorial variant only: the id of a walkthrough to start playing (missing-frontier-models, uncertainty, computers, legal-thresholds)",
    },
    hideControls: {
        type: "boolean",
        default: "false",
        description: "Hide the time slider under the chart",
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
