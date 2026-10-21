import fs from "fs-extra"
import path from "path"

/**
 * The bake steps that can re-render only the pages whose inputs changed since
 * the previous bake (`SiteBaker`'s `incremental` option).
 */
export const incrementalBakeSteps = [
    "charts",
    "multiDimPages",
    "explorers",
    "gdocPosts",
] as const

export type IncrementalBakeStep = (typeof incrementalBakeSteps)[number]

/**
 * A fingerprint of everything a page reads from the database when it is
 * rendered, keyed by the page's identifier within its bake step (a chart id,
 * a slug). Two bakes that see the same fingerprint render the same page.
 */
export type PageFingerprints = Record<string, string>

/**
 * What the baked site in a directory reflects: for each step, the
 * fingerprints of the pages it last rendered there. A step that has no entry
 * has never been baked into this directory with fingerprints, and an
 * incremental bake falls back to rendering all of its pages.
 *
 * Fingerprints describe content, not the code that renders it: after a code
 * change, only a full bake re-renders the pages whose content didn't change.
 */
export interface BakeState {
    version: typeof BAKE_STATE_VERSION
    steps: Partial<Record<IncrementalBakeStep, PageFingerprints>>
}

// Bump when fingerprints change shape, so that the next incremental bake
// re-renders everything instead of comparing incompatible fingerprints
const BAKE_STATE_VERSION = 1

/**
 * The state lives next to the baked site rather than inside it, so that
 * deploying the directory doesn't publish it.
 */
const getBakeStatePath = (bakedSiteDir: string): string =>
    `${path.resolve(bakedSiteDir)}.bake-state.json`

const emptyBakeState = (): BakeState => ({
    version: BAKE_STATE_VERSION,
    steps: {},
})

export const readBakeState = async (
    bakedSiteDir: string
): Promise<BakeState> => {
    const statePath = getBakeStatePath(bakedSiteDir)
    // A state whose directory was deleted describes pages that are gone
    if (
        !(await fs.pathExists(statePath)) ||
        !(await fs.pathExists(bakedSiteDir))
    )
        return emptyBakeState()
    let state: Partial<BakeState>
    try {
        state = await fs.readJson(statePath)
    } catch (error) {
        // A corrupt state must not fail every later bake; baking everything
        // again replaces it
        if (!(error instanceof SyntaxError)) throw error
        console.log(`Ignoring unreadable bake state in ${statePath}: ${error}`)
        return emptyBakeState()
    }
    if (state.version !== BAKE_STATE_VERSION || !state.steps) {
        console.log(
            `Ignoring bake state in ${statePath}: version ${state.version} instead of ${BAKE_STATE_VERSION}`
        )
        return emptyBakeState()
    }
    return state as BakeState
}

export const writeBakeState = async (
    bakedSiteDir: string,
    state: BakeState
): Promise<void> => {
    // Write to a temporary file and rename it, so that a bake that is killed
    // mid-write, or another bake writing at the same time, doesn't leave a
    // truncated state file behind
    const statePath = getBakeStatePath(bakedSiteDir)
    const tmpPath = `${statePath}.${process.pid}.tmp`
    await fs.writeJson(tmpPath, state)
    await fs.rename(tmpPath, statePath)
}

/**
 * The pages to re-render: those whose fingerprint differs from the previous
 * bake, and those that are new. Pages that disappeared aren't returned; each
 * step's cleanup removes their files.
 */
export const getChangedPageKeys = (
    previous: PageFingerprints,
    current: PageFingerprints
): string[] =>
    Object.keys(current).filter((key) => previous[key] !== current[key])
