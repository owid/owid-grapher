import { GrapherConfigInterface } from "grapher/core/GrapherConfig"

// This is a made-up entity to make the explorer variable dropdown possible.
// It is currently derived from single-dimensional chart entities.
export type Indicator = Pick<
    GrapherConfigInterface,
    "id" | "title" | "subtitle" | "sourceDesc" | "note" | "dimensions" | "map"
> & { id: number } // ensure `id` is not optional
