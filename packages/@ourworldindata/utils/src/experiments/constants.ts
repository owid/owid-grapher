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
