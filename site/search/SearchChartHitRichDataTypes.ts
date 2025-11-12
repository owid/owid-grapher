import { SearchChartHitComponentVariant } from "@ourworldindata/types"

export type RichDataComponentVariant = Extract<
    SearchChartHitComponentVariant,
    "large" | "medium"
>

export enum PreviewVariant {
    Thumbnail = "thumbnail",
    Large = "large",
}

export interface PreviewType {
    variant: PreviewVariant
    isMinimal: boolean
}
