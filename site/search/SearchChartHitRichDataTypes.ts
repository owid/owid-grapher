import { SearchChartHitComponentVariant } from "@ourworldindata/types"

export type RichDataComponentVariant = Extract<
    SearchChartHitComponentVariant,
    "large" | "medium"
>
