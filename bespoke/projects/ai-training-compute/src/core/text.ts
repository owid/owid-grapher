import { ColorBy } from "./constants.js"

/**
 * The multidim's subtitles for its training-compute views, which differ
 * only in what the colors show. A chart without an authored subtitle uses
 * the one for its current color.
 */
export const DEFAULT_SUBTITLES: Record<ColorBy, string> = {
    reporting:
        "Each dot is a notable AI model, placed by its publication date and the computation used to train it. Colors show whether its training compute was directly reported by the developer or indirectly estimated by Epoch AI.",
    developer:
        "Each dot is a notable AI model, placed by its publication date and the computation used to train it. Colors show the company that developed it.",
}
