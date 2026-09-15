type BespokeComponentReturnType = void | undefined | (() => void)

export interface BespokeComponentMountOpts {
    variant?: string
    config?: Record<string, string>
    /**
     * Root the component's ETL data feed is served from, e.g.
     * `https://api.ourworldindata.org/v1/bespoke`. Absent when whatever mounted the component
     * doesn't know about feeds (the dev demo pages), in which case the component falls back to
     * production -- see `setFeedRoot` in `bespoke/helpers/feedUrl.ts`.
     */
    dataUrl?: string
}

export type BespokeComponentMountFn = (
    container: HTMLDivElement,
    opts: BespokeComponentMountOpts
) => BespokeComponentReturnType | Promise<BespokeComponentReturnType>

/**
 * The expected interface for a bespoke component's ESM module.
 * The module must export a `mount` function that receives a container div
 * and configuration object. The container is isolated via Shadow DOM.
 */
export interface BespokeComponentModule {
    mount: BespokeComponentMountFn
    VARIANTS?: BespokeComponentVariantsList
}

export interface BespokeComponentVariantsEntry<
    VariantName extends string = string,
> extends Record<string, unknown> {
    name: VariantName
    demoConfig?: Record<string, string>
    demoSize?: "narrow" | "wide" | "widest"
}

export type BespokeComponentVariantsList<VariantName extends string = string> =
    BespokeComponentVariantsEntry<VariantName>[]

export interface BespokeComponentDefinition {
    /** URL to the ES module that exports the component's mount function */
    scriptUrl: string
}
