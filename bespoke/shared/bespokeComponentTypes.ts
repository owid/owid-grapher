import type { EmbedConfig } from "./embedConfig.ts"

type BespokeComponentReturnType = void | undefined | (() => void)

export interface BespokeComponentDataUrls {
    dataUrl: string
    metadataUrl: string
}

export type BespokeAuthoredConfig = Record<string, string>

export interface BespokeVariantProps<Config> {
    config: Config & EmbedConfig
    urls: BespokeComponentDataUrls
}

export interface BespokeComponentMountOpts extends Partial<BespokeComponentDataUrls> {
    variant?: string
    config?: BespokeAuthoredConfig
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
    description: string
    defaultConfig?: BespokeAuthoredConfig
    defaultSize?: "narrow" | "wide" | "widest"
}

export type BespokeComponentVariantsList<VariantName extends string = string> =
    BespokeComponentVariantsEntry<VariantName>[]

export type BespokeConfigField =
    | {
          type: "string" | "number" | "integer" | "boolean"
          default?: string
          description: string
      }
    | {
          type: "enum"
          values: readonly string[]
          default?: string
          description: string
      }
    | {
          type: "custom"
          format: string
          parse: (value: string) => unknown
          description: string
      }

export type BespokeConfigSpec = Record<string, BespokeConfigField>

export interface BespokeComponentDefinition {
    /** URL to the ES module that exports the component's mount function, relative to BESPOKE_BASE_URL */
    scriptUrl: string
    /** Folder the component's data files are served from, relative to BESPOKE_DATA_URL */
    dataUrl: string
    /** The component's metadata file inside `dataUrl` */
    metadataFilename: string
}
