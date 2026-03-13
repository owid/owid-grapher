/**
 * The expected interface for a bespoke component's ESM module.
 * The module must export a `mount` function that receives a container div
 * and configuration object. The container is isolated via Shadow DOM.
 */
export interface BespokeComponentModule {
    mount: (
        container: HTMLDivElement,
        opts: { variant?: string; config?: Record<string, string> }
    ) => void | Promise<void> | Promise<() => void>
}

export interface BespokeComponentVariantsEntry {
    name: string
    defaultConfig?: Record<string, string>
}

export type BespokeComponentVariantsList = BespokeComponentVariantsEntry[]

export interface BespokeComponentDefinition {
    /** URL to the ES module that exports the component's mount function */
    scriptUrl: string
    /** URL to the component's CSS stylesheet (loaded into shadow DOM) */
    cssUrl: string
}
