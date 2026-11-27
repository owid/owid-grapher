// Checks every `data-track-note` attribute in this project's JSX against the
// TrackNote list. Each project that sets the attribute has a copy of this
// file: declaring it once in @ourworldindata/types would leak it into the
// published type declarations of @ourworldindata/grapher.

import type { TrackNote } from "@ourworldindata/types"

declare module "react" {
    interface HTMLAttributes<T> {
        "data-track-note"?: TrackNote
    }
}
