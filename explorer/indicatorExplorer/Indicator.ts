import { GrapherScript } from "charts/core/GrapherInterface"

// This is a made-up entity to make the explorer variable dropdown possible.
// It is currently derived from single-dimensional chart entities.
export type Indicator = Pick<
    GrapherScript,
    "id" | "title" | "subtitle" | "sourceDesc" | "note" | "dimensions" | "map"
> & { id: number } // ensure `id` is not optional
