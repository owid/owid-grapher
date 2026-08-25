type BespokeComponentReturnType = void | undefined | (() => void)

export type BespokeComponentMountFn = (
    container: HTMLDivElement,
    opts: { variant?: string; config?: Record<string, string> }
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
    /** URL to the ES module that exports the component's mount function, relative to BESPOKE_BASE_URL */
    scriptUrl: string
    /** Absolute URL to the component's metadata file, served from the public data bucket rather than the site's asset path */
    metadataUrl?: string
}
