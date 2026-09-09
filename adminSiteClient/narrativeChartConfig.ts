import * as _ from "lodash-es"
import {
    GrapherInterface,
    NARRATIVE_CHART_PROPS_TO_OMIT,
    NARRATIVE_CHART_PROPS_TO_PERSIST,
} from "@ourworldindata/types"
import { diffGrapherConfigs } from "@ourworldindata/utils"
import { defaultGrapherConfig } from "@ourworldindata/grapher"

/**
 * The patch config a narrative chart is saved with: what the live config adds
 * on top of its parent, plus an explicit snapshot of the props a narrative
 * chart always owns.
 */
export function makeNarrativeChartPatchConfig(
    liveConfigWithDefaults: GrapherInterface,
    // Diff against the defaults if no parent layer is applied
    parentConfigWithDefaults: GrapherInterface = defaultGrapherConfig
): GrapherInterface {
    // The live config without the props that are always omitted from a narrative chart's config
    const liveConfig = _.omit(
        liveConfigWithDefaults,
        NARRATIVE_CHART_PROPS_TO_OMIT
    )

    // What the live config adds on top of its parent
    const patchToParent = diffGrapherConfigs(
        liveConfig,
        parentConfigWithDefaults
    )

    // The props that are always persisted in a narrative chart's config,
    // even if they match the parent chart's config
    const alwaysPersistedProps = _.pick(
        liveConfigWithDefaults,
        NARRATIVE_CHART_PROPS_TO_PERSIST
    )

    return { ...patchToParent, ...alwaysPersistedProps }
}
