import { SearchChartHitComponentVariant } from "@ourworldindata/types"

export type RichDataComponentVariant = Extract<
    SearchChartHitComponentVariant,
    "large" | "medium"
>

export enum PreviewVariant {
    Thumbnail = "thumbnail",
    /**
     * A thumbnail with no text in it at all — no legend, no series or value
     * labels. The value is the `imType` the thumbnail endpoint answers to; see
     * getNakedThumbnailOptions in functions/_common/imageOptions.ts.
     */
    NakedThumbnail = "naked-thumbnail",
    Large = "large",
}

export interface PreviewType {
    variant: PreviewVariant
    isMinimal: boolean
}
