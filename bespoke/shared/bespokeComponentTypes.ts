type BespokeComponentReturnType = void | undefined | (() => void)

export interface BespokeComponentDataUrls {
    dataUrl: string
    metadataUrl: string
}

export interface BespokeComponentMountOpts extends Partial<BespokeComponentDataUrls> {
    variant?: string
    config?: Record<string, string>
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
    /** URL to the ES module that exports the component's mount function, relative to BESPOKE_BASE_URL */
    scriptUrl: string
    /** Folder the component's data files are served from, relative to BESPOKE_DATA_URL */
    dataUrl: string
    /**
     * The data files ship in the bundle's own build output instead of an ETL
     * feed, so `dataUrl` is relative to BESPOKE_BASE_URL like `scriptUrl`. A
     * stopgap for data that has no ETL step yet.
     */
    dataBundled?: boolean
    /** The component's metadata file inside `dataUrl` */
    metadataFilename: string
}
