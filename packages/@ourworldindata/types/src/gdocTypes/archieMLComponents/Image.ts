import { Span } from "../Spans.js"
import {
    BlockSize,
    BlockVisibility,
    EnrichedBlockWithParseErrors,
} from "./generic.js"

export type RawBlockImage = {
    type: "image"
    value: {
        filename?: string
        smallFilename?: string
        alt?: string
        caption?: string
        size?: BlockSize
        hasOutline?: string
        visibility?: string
    }
}

/**
 * A static image uploaded to the OWID admin. The `filename` must match an
 * image registered in the admin (where default alt text is also set).
 *
 * ## When to use
 * - Photographs, illustrations, diagrams, and static (non-interactive)
 *   visuals.
 * - Static grapher exports where the reader doesn't need to interact with
 *   the chart — consider `hasOutline: true` for clean white-background
 *   screenshots so they read as visuals rather than floating artwork.
 *
 * ## When NOT to use
 * - Interactive charts — use `{.chart}` or `{.narrative-chart}`.
 * - Flagship data visualizations with metadata — use `{.static-viz}`.
 * - Videos — use `{.video}`.
 *
 * ## Variations
 * - `size`: `narrow` | `wide` (default) | `widest`
 * - `visibility`: `mobile` | `desktop` — pair two image blocks to swap
 *   aspect ratio between layouts.
 * - `smallFilename`: dedicated mobile image (should be ≥1600px wide).
 * - `hasOutline`: `true` | `false` — adds a 1px light-gray outline, useful
 *   for images with white backgrounds.
 *
 * @owid-component image
 * @owid-title Image
 * @example Full featured
 * ```archie
 * {.image}
 * filename: default-featured-image.png
 * smallFilename: default-featured-image.png
 * alt: my alt text that is optional
 * size: narrow
 * caption: I am a caption that would appear below the image
 * hasOutline: true
 * visibility: desktop
 * {}
 * ```
 * @example Minimal
 * ```archie
 * {.image}
 * filename: default-featured-image.png
 * {}
 * ```
 */
export type EnrichedBlockImage = {
    type: "image"
    filename: string
    smallFilename?: string
    alt?: string // optional as we can use the default alt from the file
    caption?: Span[]
    originalWidth?: number
    size: BlockSize
    hasOutline: boolean
    visibility?: BlockVisibility
    // Not a real ArchieML prop - we set this to true for Data Insights, as a way to migrate
    // first generation data insights to only use their small image
    // See https://github.com/owid/owid-grapher/issues/4416
    preferSmallFilename?: boolean
} & EnrichedBlockWithParseErrors
