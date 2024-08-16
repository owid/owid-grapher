import {
    isEqual,
    omit,
    GrapherInterface,
    diffGrapherConfigs,
    mergeGrapherConfigs,
} from "@ourworldindata/utils"
import { action, computed, observable, when } from "mobx"
import { EditorFeatures } from "./EditorFeatures.js"
import { Admin } from "./Admin.js"
import { defaultGrapherConfig, Grapher } from "@ourworldindata/grapher"

export type EditorTab =
    | "basic"
    | "data"
    | "text"
    | "customize"
    | "map"
    | "scatter"
    | "marimekko"
    | "revisions"
    | "refs"
    | "export"
    | "inheritance"

export interface AbstractChartEditorManager {
    admin: Admin
    patchConfig: GrapherInterface
    parentConfig?: GrapherInterface
    isInheritanceEnabled?: boolean
}

export abstract class AbstractChartEditor<
    Manager extends AbstractChartEditorManager = AbstractChartEditorManager,
> {
    manager: Manager

    @observable.ref grapher = new Grapher()
    @observable.ref currentRequest: Promise<any> | undefined // Whether the current chart state is saved or not
    @observable.ref tab: EditorTab = "basic"
    @observable.ref errorMessage?: { title: string; content: string }
    @observable.ref previewMode: "mobile" | "desktop"
    @observable.ref showStaticPreview = false
    @observable.ref savedPatchConfig: GrapherInterface = {}

    // parent config derived from the current chart config
    @observable.ref parentConfig: GrapherInterface | undefined = undefined
    // if inheritance is enabled, the parent config is applied to grapher
    @observable.ref isInheritanceEnabled: boolean | undefined = undefined

    constructor(props: { manager: Manager }) {
        this.manager = props.manager
        this.previewMode =
            localStorage.getItem("editorPreviewMode") === "mobile"
                ? "mobile"
                : "desktop"

        when(
            () => this.manager.parentConfig !== undefined,
            () => (this.parentConfig = this.manager.parentConfig)
        )

        when(
            () => this.manager.isInheritanceEnabled !== undefined,
            () =>
                (this.isInheritanceEnabled = this.manager.isInheritanceEnabled)
        )

        when(
            () => this.grapher.hasData && this.grapher.isReady,
            () => (this.savedPatchConfig = this.patchConfig)
        )
    }

    /** original grapher config used to init the grapher instance */
    @computed get originalGrapherConfig(): GrapherInterface {
        const { patchConfig, parentConfig, isInheritanceEnabled } = this.manager
        if (!isInheritanceEnabled) return patchConfig
        return mergeGrapherConfigs(parentConfig ?? {}, patchConfig)
    }

    /** live-updating full config */
    @computed get fullConfig(): GrapherInterface {
        return mergeGrapherConfigs(defaultGrapherConfig, this.grapher.object)
    }

    /** parent config currently applied to grapher */
    @computed get activeParentConfig(): GrapherInterface | undefined {
        return this.isInheritanceEnabled ? this.parentConfig : undefined
    }

    @computed get activeParentConfigWithDefaults():
        | GrapherInterface
        | undefined {
        if (!this.activeParentConfig) return undefined
        return mergeGrapherConfigs(
            defaultGrapherConfig,
            this.activeParentConfig
        )
    }

    /** patch config of the chart that is written to the db on save */
    @computed get patchConfig(): GrapherInterface {
        return diffGrapherConfigs(
            this.fullConfig,
            this.activeParentConfigWithDefaults ?? defaultGrapherConfig
        )
    }

    @computed get isModified(): boolean {
        return !isEqual(
            omit(this.patchConfig, "version"),
            omit(this.savedPatchConfig, "version")
        )
    }

    @computed get features(): EditorFeatures {
        return new EditorFeatures(this)
    }

    @action.bound updateLiveGrapher(config: GrapherInterface): void {
        this.grapher.reset()
        this.grapher.updateFromObject(config)
        this.grapher.updateAuthoredVersion(config)
    }

    // only works for top-level properties
    isPropertyInherited(property: keyof GrapherInterface): boolean {
        if (!this.isInheritanceEnabled || !this.activeParentConfigWithDefaults)
            return false
        return (
            !Object.hasOwn(this.patchConfig, property) &&
            Object.hasOwn(this.activeParentConfigWithDefaults, property)
        )
    }

    // only works for top-level properties
    couldPropertyBeInherited(property: keyof GrapherInterface): boolean {
        if (!this.isInheritanceEnabled || !this.activeParentConfig) return false
        return Object.hasOwn(this.activeParentConfig, property)
    }

    abstract get isNewGrapher(): boolean
    abstract get availableTabs(): EditorTab[]

    abstract saveGrapher(props?: { onError?: () => void }): Promise<void>
}
