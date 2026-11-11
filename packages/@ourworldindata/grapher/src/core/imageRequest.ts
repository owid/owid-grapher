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
    [GrapherVariant.Thumbnail]: [
        ChartLabelMode.All,
        ChartLabelMode.Values,
        ChartLabelMode.Names,
        ChartLabelMode.None,
    ],
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

/** The request an image URL without image params parses to */
export const DEFAULT_IMAGE_REQUEST: ImageRequest = {
    variant: GrapherVariant.Default,
    labelMode: ChartLabelMode.All,
    size: { kind: "explicit" },
    includeDetails: false,
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

    params.sort()

    return params
}

class ImageRequestParseError extends Error {
    readonly details: ImageRequestError

    constructor(param: string, reason: string) {
        super(`${param}: ${reason}`)
        this.details = { param, reason }
    }
}

function parseImageRequestOrThrow(params: URLSearchParams): ImageRequest {
    if (params.has("imType") && params.has("imVariant"))
        throw new ImageRequestParseError(
            "imType",
            "cannot be combined with imVariant"
        )
    if (params.has("imType") && params.has("imPreset"))
        throw new ImageRequestParseError(
            "imType",
            "cannot be combined with imPreset"
        )
    if (params.has("imMinimal") && params.has("imLabels"))
        throw new ImageRequestParseError(
            "imMinimal",
            "cannot be combined with imLabels"
        )

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
            throw new ImageRequestParseError(
                "imWidth",
                "not allowed with a preset size"
            )
        if (height !== undefined)
            throw new ImageRequestParseError(
                "imHeight",
                "not allowed with a preset size"
            )
        if (fontSize !== undefined)
            throw new ImageRequestParseError(
                "imFontSize",
                "not allowed with a preset size"
            )
        if (includeDetails)
            throw new ImageRequestParseError(
                "imDetails",
                "not allowed with a preset size"
            )
        if (variant !== GrapherVariant.Default)
            throw new ImageRequestParseError(
                "imPreset",
                `not allowed with imVariant=${variantToken}`
            )
    }

    if (includeDetails && variant !== GrapherVariant.Default)
        throw new ImageRequestParseError(
            "imDetails",
            `not allowed with imVariant=${variantToken}`
        )

    const variantWithLabelMode = { variant, labelMode }
    if (!isLabelModeAllowed(variantWithLabelMode))
        throw new ImageRequestParseError(
            labelParam,
            `not allowed with imVariant=${variantToken}`
        )

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
    if (variant === undefined)
        throw new ImageRequestParseError(
            "imVariant",
            `unknown value "${token}"`
        )
    return variant
}

function parsePreset(value: string | null): ImageSizePreset | undefined {
    if (value === null) return undefined
    const preset = SIZE_PRESETS.find((preset) => preset === value)
    if (preset === undefined)
        throw new ImageRequestParseError("imPreset", `unknown value "${value}"`)
    return preset
}

function parseLabelMode(value: string | null): ChartLabelMode {
    if (value === null) return ChartLabelMode.All
    const labelMode = Object.values(ChartLabelMode).find(
        (mode) => mode === value
    )
    if (labelMode === undefined)
        throw new ImageRequestParseError("imLabels", `unknown value "${value}"`)
    return labelMode
}

function parseLegacyType(
    value: string | null
): { variant: GrapherVariant; preset?: ImageSizePreset } | undefined {
    if (value === null) return undefined
    const legacyType = LEGACY_IMAGE_TYPES.get(value)
    if (legacyType === undefined)
        throw new ImageRequestParseError("imType", `unknown value "${value}"`)
    return legacyType
}

function parseLegacyMinimal(value: string | null): ChartLabelMode {
    return parseFlag("imMinimal", value)
        ? ChartLabelMode.Values
        : ChartLabelMode.All
}

function parseFlag(param: string, value: string | null): boolean {
    if (value === null || value === "0") return false
    if (value === "1") return true
    throw new ImageRequestParseError(param, `expected 0 or 1, got "${value}"`)
}

function parsePositiveInteger(
    param: string,
    params: URLSearchParams
): number | undefined {
    const value = params.get(param)
    if (value === null) return undefined
    const number = Number(value)
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number <= 0)
        throw new ImageRequestParseError(
            param,
            `expected a positive integer, got "${value}"`
        )
    return number
}
