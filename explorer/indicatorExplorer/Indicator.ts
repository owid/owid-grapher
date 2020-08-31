import { ChartScript } from "charts/core/ChartScript"

// This is a made-up entity to make the explorer variable dropdown possible.
// It is currently derived from single-dimensional chart entities.
export type Indicator = Pick<
    ChartScript,
    "id" | "title" | "subtitle" | "sourceDesc" | "note" | "dimensions" | "map"
> & { id: number } // ensure `id` is not optional
