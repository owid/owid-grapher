import {
    defaultExperimentState,
    getExperimentState,
} from "@ourworldindata/utils"

// Experiment state is not reactive and won't change during a page session,
// so we compute it once at module load time (client-side only).
export const experimentState =
    typeof window !== "undefined"
        ? getExperimentState()
        : defaultExperimentState
