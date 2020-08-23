import { ChartConfigProps } from "charts/core/ChartConfig"

// This is a made-up entity to make the explorer variable dropdown possible.
// It is currently derived from single-dimensional chart entities.
export type Indicator = Pick<
    ChartConfigProps,
    "id" | "title" | "subtitle" | "sourceDesc" | "note" | "dimensions" | "map"
> & { id: number } // ensure `id` is not optional
