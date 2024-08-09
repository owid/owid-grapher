import {
    isEqual,
    omit,
    GrapherInterface,
    diffGrapherConfigs,
    mergeGrapherConfigs,
    merge,
} from "@ourworldindata/utils"
import { computed, observable, when } from "mobx"
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
    @observable.ref parentConfig: GrapherInterface | undefined = undefined

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
            () => this.grapher.hasData && this.grapher.isReady,
            () => (this.savedPatchConfig = this.patchConfig)
        )
    }

    /** default object with all possible keys */
    private fullDefaultObject = merge(
        {},
        Grapher.defaultObject(), // contains all keys
        defaultGrapherConfig // contains a subset of keys with the right defaults
    )

    /** original grapher config used to init the grapher instance */
    @computed get originalGrapherConfig(): GrapherInterface {
        const { patchConfig, parentConfig } = this.manager
        if (!parentConfig) return patchConfig
        return mergeGrapherConfigs(parentConfig, patchConfig)
    }

    /** live-updating full config */
    @computed get fullConfig(): GrapherInterface {
        return mergeGrapherConfigs(this.fullDefaultObject, this.grapher.object)
    }

    @computed get patchConfig(): GrapherInterface {
        return diffGrapherConfigs(
            this.fullConfig,
            this.parentConfigWithDefaults ?? this.fullDefaultObject
        )
    }

    @computed get parentConfigWithDefaults(): GrapherInterface | undefined {
        if (!this.parentConfig) return undefined
        return mergeGrapherConfigs(this.fullDefaultObject, this.parentConfig)
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

    // TODO: only works for first level at the moment
    isPropertyInherited(property: keyof GrapherInterface): boolean {
        if (!this.parentConfig) return false
        return (
            !Object.hasOwn(this.patchConfig, property) &&
            Object.hasOwn(this.parentConfig, property)
        )
    }

    abstract get isNewGrapher(): boolean
    abstract get availableTabs(): EditorTab[]

    abstract saveGrapher(props?: { onError?: () => void }): Promise<void>
}
