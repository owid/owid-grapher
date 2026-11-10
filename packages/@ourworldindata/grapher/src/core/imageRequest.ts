import { ChartLabelMode, GrapherVariant } from "@ourworldindata/types"

const SIZE_PRESETS = ["og", "twitter", "square"] as const

export type ImageSizePreset = (typeof SIZE_PRESETS)[number]

export interface PresetImageSize {
    kind: "preset"
    preset: ImageSizePreset
}

export interface ExplicitImageSize {
    kind: "explicit"
    width?: number
    height?: number
    fontSize?: number
}

const LABEL_MODES_BY_VARIANT = {
    [GrapherVariant.Default]: [ChartLabelMode.All],
    [GrapherVariant.Uncaptioned]: [ChartLabelMode.All, ChartLabelMode.Values],
    [GrapherVariant.Thumbnail]: [ChartLabelMode.All, ChartLabelMode.Values],
} as const satisfies Record<GrapherVariant, readonly ChartLabelMode[]>

type LabelModeOf<Variant extends GrapherVariant> =
    (typeof LABEL_MODES_BY_VARIANT)[Variant][number]

type VariantWithLabelMode = {
    [Variant in GrapherVariant]: {
        variant: Variant
        labelMode: LabelModeOf<Variant>
    }
}[GrapherVariant]

export type ImageRequest =
    | {
          variant: GrapherVariant.Default
          labelMode: LabelModeOf<GrapherVariant.Default>
          size: ExplicitImageSize
          includeDetails: boolean
      }
    | {
          variant: GrapherVariant.Default
          labelMode: LabelModeOf<GrapherVariant.Default>
          size: PresetImageSize
          includeDetails: false
      }
    | {
          variant: GrapherVariant.Uncaptioned
          labelMode: LabelModeOf<GrapherVariant.Uncaptioned>
          size: ExplicitImageSize
          includeDetails: false
      }
    | {
          variant: GrapherVariant.Thumbnail
          labelMode: LabelModeOf<GrapherVariant.Thumbnail>
          size: ExplicitImageSize
          includeDetails: false
      }

export interface ImageRequestError {
    param: string
    reason: string
}

export type ParseImageRequestResult =
    | { ok: true; request: ImageRequest }
    | { ok: false; error: ImageRequestError }

const URL_TOKEN_BY_VARIANT = {
    [GrapherVariant.Default]: "captioned",
    [GrapherVariant.Uncaptioned]: "uncaptioned",
    [GrapherVariant.Thumbnail]: "simplified",
} as const satisfies Record<GrapherVariant, string>

const LEGACY_IMAGE_TYPES = new Map<
    string,
    { variant: GrapherVariant; preset?: ImageSizePreset }
>([
    ["og", { variant: GrapherVariant.Default, preset: "og" }],
    ["twitter", { variant: GrapherVariant.Default, preset: "twitter" }],
    ["square", { variant: GrapherVariant.Default, preset: "square" }],
    ["thumbnail", { variant: GrapherVariant.Thumbnail }],
    ["uncaptioned", { variant: GrapherVariant.Uncaptioned }],
])

const IMAGE_PARAMS = [
    "imVariant",
    "imLabels",
    "imPreset",
    "imWidth",
    "imHeight",
    "imFontSize",
    "imDetails",
]

const LEGACY_IMAGE_PARAMS = ["imType", "imMinimal"]

const ACCEPTED_PARAMS: ReadonlySet<string> = new Set([
    ...IMAGE_PARAMS,
    ...LEGACY_IMAGE_PARAMS,
])

export function parseImageRequest(
    params: URLSearchParams
): ParseImageRequestResult {
    try {
        return { ok: true, request: parseImageRequestOrThrow(params) }
    } catch (error) {
        if (error instanceof ImageRequestParseError)
            return { ok: false, error: error.details }
        throw error
    }
}

export function serializeImageRequest(request: ImageRequest): URLSearchParams {
    const params = new URLSearchParams()

    if (request.variant !== GrapherVariant.Default)
        params.set("imVariant", URL_TOKEN_BY_VARIANT[request.variant])
    if (request.labelMode !== ChartLabelMode.All)
        params.set("imLabels", request.labelMode)

    if (request.size.kind === "preset") {
        params.set("imPreset", request.size.preset)
    } else {
        const { width, height, fontSize } = request.size
        if (width !== undefined) params.set("imWidth", String(width))
        if (height !== undefined) params.set("imHeight", String(height))
        if (fontSize !== undefined) params.set("imFontSize", String(fontSize))
    }

    if (request.includeDetails) params.set("imDetails", "1")

    return params
}

class ImageRequestParseError extends Error {
    constructor(readonly details: ImageRequestError) {
        super(`${details.param}: ${details.reason}`)
    }
}

function fail(param: string, reason: string): never {
    throw new ImageRequestParseError({ param, reason })
}

function parseImageRequestOrThrow(params: URLSearchParams): ImageRequest {
    for (const key of params.keys()) {
        if (key.startsWith("im") && !ACCEPTED_PARAMS.has(key))
            fail(key, "unknown parameter")
    }

    if (params.has("imType") && params.has("imVariant"))
        fail("imType", "cannot be combined with imVariant")
    if (params.has("imType") && params.has("imPreset"))
        fail("imType", "cannot be combined with imPreset")
    if (params.has("imMinimal") && params.has("imLabels"))
        fail("imMinimal", "cannot be combined with imLabels")

    const legacyType = parseLegacyType(params.get("imType"))
    const variant =
        parseVariant(params.get("imVariant")) ??
        legacyType?.variant ??
        GrapherVariant.Default
    const variantToken = URL_TOKEN_BY_VARIANT[variant]
    const preset = parsePreset(params.get("imPreset")) ?? legacyType?.preset
    const labelParam = params.has("imMinimal") ? "imMinimal" : "imLabels"
    const labelMode =
        labelParam === "imMinimal"
            ? parseLegacyMinimal(params.get("imMinimal"))
            : parseLabelMode(params.get("imLabels"))
    const fontSize = parsePositiveInteger("imFontSize", params)
    const includeDetails = parseFlag("imDetails", params.get("imDetails"))
    const width = parsePositiveInteger("imWidth", params)
    const height = parsePositiveInteger("imHeight", params)

    if (preset) {
        if (width !== undefined)
            fail("imWidth", "not allowed with a preset size")
        if (height !== undefined)
            fail("imHeight", "not allowed with a preset size")
        if (fontSize !== undefined)
            fail("imFontSize", "not allowed with a preset size")
        if (includeDetails) fail("imDetails", "not allowed with a preset size")
        if (variant !== GrapherVariant.Default)
            fail("imPreset", `not allowed with imVariant=${variantToken}`)
    }

    if (includeDetails && variant !== GrapherVariant.Default)
        fail("imDetails", `not allowed with imVariant=${variantToken}`)

    const variantWithLabelMode = { variant, labelMode }
    if (!isLabelModeAllowed(variantWithLabelMode))
        fail(labelParam, `not allowed with imVariant=${variantToken}`)

    const explicitSize: ExplicitImageSize = {
        kind: "explicit",
        ...(width !== undefined && { width }),
        ...(height !== undefined && { height }),
        ...(fontSize !== undefined && { fontSize }),
    }
    const presetSize: PresetImageSize | undefined = preset
        ? { kind: "preset", preset }
        : undefined

    switch (variantWithLabelMode.variant) {
        case GrapherVariant.Default:
            return presetSize
                ? {
                      ...variantWithLabelMode,
                      size: presetSize,
                      includeDetails: false,
                  }
                : {
                      ...variantWithLabelMode,
                      size: explicitSize,
                      includeDetails,
                  }
        case GrapherVariant.Uncaptioned:
        case GrapherVariant.Thumbnail:
            return {
                ...variantWithLabelMode,
                size: explicitSize,
                includeDetails: false,
            }
    }
}

function isLabelModeAllowed(candidate: {
    variant: GrapherVariant
    labelMode: ChartLabelMode
}): candidate is VariantWithLabelMode {
    const allowed: readonly ChartLabelMode[] =
        LABEL_MODES_BY_VARIANT[candidate.variant]
    return allowed.includes(candidate.labelMode)
}

function parseVariant(token: string | null): GrapherVariant | undefined {
    if (token === null) return undefined
    const variant = Object.values(GrapherVariant).find(
        (variant) => URL_TOKEN_BY_VARIANT[variant] === token
    )
    return variant ?? fail("imVariant", `unknown value "${token}"`)
}

function parsePreset(value: string | null): ImageSizePreset | undefined {
    if (value === null) return undefined
    return (
        SIZE_PRESETS.find((preset) => preset === value) ??
        fail("imPreset", `unknown value "${value}"`)
    )
}

function parseLabelMode(value: string | null): ChartLabelMode {
    if (value === null) return ChartLabelMode.All
    return (
        Object.values(ChartLabelMode).find((mode) => mode === value) ??
        fail("imLabels", `unknown value "${value}"`)
    )
}

function parseLegacyType(
    value: string | null
): { variant: GrapherVariant; preset?: ImageSizePreset } | undefined {
    if (value === null) return undefined
    return (
        LEGACY_IMAGE_TYPES.get(value) ??
        fail("imType", `unknown value "${value}"`)
    )
}

function parseLegacyMinimal(value: string | null): ChartLabelMode {
    return parseFlag("imMinimal", value)
        ? ChartLabelMode.Values
        : ChartLabelMode.All
}

function parseFlag(param: string, value: string | null): boolean {
    if (value === null || value === "0") return false
    if (value === "1") return true
    return fail(param, `expected 0 or 1, got "${value}"`)
}

function parsePositiveInteger(
    param: string,
    params: URLSearchParams
): number | undefined {
    const value = params.get(param)
    if (value === null) return undefined
    const number = Number(value)
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number <= 0)
        fail(param, `expected a positive integer, got "${value}"`)
    return number
}
