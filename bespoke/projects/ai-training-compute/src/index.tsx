import { createRoot } from "react-dom/client"
import { enableShadowDOM } from "@react-stately/flags"

import type {
    BespokeComponentMountFn,
    BespokeComponentMountOpts,
    BespokeComponentVariantsList,
    BespokeConfigSpec,
} from "owid-bespoke-types"
import StylesTarget from "vite-plugin-css-position/react"

import { ConfigFromSpec, parseConfigFromSpec } from "../../../helpers/config.js"
import { EmbedOptionsProvider } from "../../../hooks/useEmbedOptions.js"

import {
    COLOR_BY_OPTIONS,
    VariantName,
    Y_SCALE_TYPES,
} from "./core/constants.js"
import { parseFlopBound } from "./core/config.js"
import { ScatterVariant } from "./variants/ScatterVariant.js"

import "./index.scss"

// Enable react-aria's internal Shadow DOM handling paths.
// Must be called before any react-aria components render.
enableShadowDOM()

export const VARIANTS = [
    {
        name: "scatter",
        description:
            "The computation used to train each notable AI model, by publication date, colored by developer or by whether the figure was reported or estimated",
        component: ScatterVariant,
    },
] satisfies BespokeComponentVariantsList<VariantName>

export const CONFIG_SPEC = {
    title: {
        type: "string",
        default: "Computation used to train notable AI models",
        description: "Chart title",
    },
    subtitle: {
        type: "string",
        description:
            "Chart subtitle. Defaults to the multidim's subtitle for the current color, which explains what the colors show",
    },
    note: {
        type: "string",
        default:
            "One floating-point operation (FLOP) is a single calculation, such as adding or multiplying two decimal numbers. Where developers do not report it, Epoch AI estimates training compute from a model’s size, training data, hardware, or cost; the least-documented estimates may be off by a factor of about 30. About half of notable models have no compute figure and are not shown.",
        description: "Note in the chart's footer",
    },
    startYear: {
        type: "integer",
        description:
            "First year on the time axis. Defaults to the year of the earliest model",
    },
    endYear: {
        type: "integer",
        description:
            "Last year on the time axis, included in full. Defaults to the year of the latest model",
    },
    yAxisMin: {
        type: "custom",
        format: "A number of FLOP, such as `1e24`, `10^24` or `10²⁴`",
        parse: parseFlopBound,
        description:
            "Bottom of the y axis. Defaults to fit the models in view, from 0 on a linear axis",
    },
    yAxisMax: {
        type: "custom",
        format: "A number of FLOP, such as `1e27`, `10^27` or `10²⁷`",
        parse: parseFlopBound,
        description: "Top of the y axis. Defaults to fit the models in view",
    },
    yScale: {
        type: "enum",
        values: Y_SCALE_TYPES,
        default: "log",
        description: "Whether the y axis starts logarithmic or linear",
    },
    hideYScaleToggle: {
        type: "boolean",
        default: "false",
        description: "Hide the switch between a logarithmic and linear y axis",
    },
    colorBy: {
        type: "enum",
        values: COLOR_BY_OPTIONS,
        default: "reporting",
        description:
            "What the dot colors show at first: whether the figure was reported by the developer or estimated by Epoch AI, or the developer",
    },
    hideColorBy: {
        type: "boolean",
        default: "false",
        description: "Hide the “Color by” dropdown",
    },
    showUncertainty: {
        type: "boolean",
        default: "false",
        description:
            "Draw each estimate's 90% uncertainty range, from Epoch AI's confidence in it",
    },
    labeledModels: {
        type: "string",
        default:
            "GPT-6 Astra, AlexNet, GPT-3 175B (davinci), AlphaGo Lee, Theseus, Perceptron Mark I, TD-Gammon, AlphaFold 2, GPT-4 (Mar 2023), NetTalk (transcription), Neocognitron, ADALINE, GraphCast",
        description:
            "Comma-separated model names (as in the data) to label on the chart, most important first",
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

    if (!opts.dataUrl || !opts.metadataUrl) {
        container.textContent =
            "Missing data URLs: add an entry for this bundle to the bespoke component registry"
        return
    }

    const urls = { dataUrl: opts.dataUrl, metadataUrl: opts.metadataUrl }
    const config = parseConfigFromSpec(CONFIG_SPEC, opts.config ?? {})

    const root = createRoot(container)
    root.render(
        <>
            {/* Vite-injected styles land here, inside the Shadow DOM */}
            <StylesTarget />
            <EmbedOptionsProvider options={opts.embedOptions}>
                <variant.component config={config} urls={urls} />
            </EmbedOptionsProvider>
        </>
    )
    return () => root.unmount()
}
