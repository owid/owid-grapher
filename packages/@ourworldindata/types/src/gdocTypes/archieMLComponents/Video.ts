import { Span } from "../Spans.js"
import { BlockVisibility, EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockVideo = {
    type: "video"
    value: {
        url?: string
        caption?: string
        shouldLoop?: string
        shouldAutoplay?: string
        filename?: string
        visibility?: string
    }
}

/**
 * An embedded video hosted on OWID's CloudFlare. Videos are not hosted in
 * Google Drive — a developer must upload the compressed video first
 * (compress via Handbrake before uploading).
 *
 * ## When to use
 * - Short screencasts, animations, or motion visuals that need autoplay /
 *   loop behavior.
 *
 * ## When NOT to use
 * - External videos (YouTube, Vimeo) — use an iframe inside an `{.html}`
 *   block.
 * - Static imagery — use `{.image}`.
 *
 * ## Variations
 * - `shouldLoop`: `true` | `false`
 * - `shouldAutoplay`: `true` | `false`
 * - `visibility`: `mobile` | `desktop`
 * - `filename` is the poster / preview image (same aspect ratio as the
 *   video, usually the first frame) and must be registered in the admin.
 *
 * @owid-component video
 * @owid-title Video
 * @example Looping autoplay with a poster image
 * ```archie
 * {.video}
 * url: https://assets.ourworldindata.org/videos/bunny.mp4
 * filename: bunny-poster.jpg
 * shouldLoop: true
 * shouldAutoplay: true
 * visibility: desktop
 * caption: I am a caption for this video. I can have links.
 * {}
 * ```
 */
export type EnrichedBlockVideo = {
    type: "video"
    url: string
    shouldLoop: boolean
    shouldAutoplay: boolean
    filename: string
    caption?: Span[]
    visibility?: BlockVisibility
} & EnrichedBlockWithParseErrors
