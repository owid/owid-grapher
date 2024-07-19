import {
    isEqual,
    omit,
    GrapherInterface,
    diffGrapherConfigs,
    mergeGrapherConfigs,
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

    @computed get originalGrapherConfig(): GrapherInterface {
        const { patchConfig, parentConfig } = this.manager
        if (!parentConfig) return patchConfig
        return mergeGrapherConfigs(parentConfig, patchConfig)
    }

    @computed get liveConfig(): GrapherInterface {
        return this.grapher.object
    }

    @computed get patchConfig(): GrapherInterface {
        const { liveConfig, parentConfig } = this
        if (!parentConfig) return liveConfig
        // Grapher's toObject method doesn't include default values,
        // but the patch config might need to overwrite non-default values
        // from the parent layer. That's why we merge the default grapher config
        // in here. The parent config also contains defaults, meaning we're
        // getting rid of the defaults when we diff against the parent config below.
        const liveConfigWithDefaults = mergeGrapherConfigs(
            defaultGrapherConfig,
            liveConfig
        )
        return diffGrapherConfigs(liveConfigWithDefaults, parentConfig)
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

    abstract get isNewGrapher(): boolean
    abstract get availableTabs(): EditorTab[]

    abstract saveGrapher(props?: { onError?: () => void }): Promise<void>
}
