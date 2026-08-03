// Constants for a/b experiments

export const EXPERIMENT_ARM_SEPARATOR = "--"
export const EXPERIMENT_PREFIX = "exp"

// Raw id (without the `exp-` prefix) of the data page metadata box experiment.
// Shared between the baker (to decide which charts get the extra per-indicator
// metadata loaded) and the data page React component (to gate the dual-arm
// markup), so the experiment's `paths` list is the single source of truth for
// which graphers are enrolled.
export const DATA_PAGE_METADATA_EXPERIMENT_ID = "data-page-metadata-v1"
export const DATA_PAGE_METADATA_EXPERIMENT_TREATMENT_ARM = "treatment"

// The randomised follow-up: 200 data pages, cluster randomised page by page.
// v1's 10 pages stay enrolled in v1 rather than moving here — they already have
// months of history on the new design, so they can't serve as either arm of a
// clean randomised comparison. The two path sets are therefore disjoint, and a
// page shows the redesign if either experiment puts it in the treatment arm.
export const DATA_PAGE_METADATA_V2_EXPERIMENT_ID = "data-page-metadata-v2"
