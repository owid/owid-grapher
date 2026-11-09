// Constants for a/b experiments

export const EXPERIMENT_ARM_SEPARATOR = "--"
export const EXPERIMENT_PREFIX = "exp"

// Raw id (without the `exp-` prefix) of the /latest sticky filters experiment.
// Shared between the experiment config, the /latest React components (to
// gate the reveal-on-scroll behaviour) and the analytics layer (to tag the
// /latest events with the visitor's arm).
export const LATEST_STICKY_FILTERS_EXPERIMENT_ID = "latest-sticky-filters-v1"
export const LATEST_STICKY_FILTERS_ARMS = {
    notSticky: "not-sticky",
    revealOnScrollUp: "reveal-on-scroll-up",
    fullySticky: "fully-sticky",
} as const
