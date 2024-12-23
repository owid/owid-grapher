import { IReactionDisposer, action, autorun, computed, observable } from "mobx"
import { observer } from "mobx-react"
import { Component } from "react"
import { Section, Toggle } from "./Forms.js"
import { Grapher } from "@ourworldindata/grapher"
import {
    triggerDownloadFromBlob,
    GrapherStaticFormat,
} from "@ourworldindata/utils"
import { AbstractChartEditor } from "./AbstractChartEditor.js"

type ExportSettings = Required<
    Pick<
        Grapher,
        | "hideTitle"
        | "forceHideAnnotationFieldsInTitle"
        | "hideSubtitle"
        | "hideNote"
        | "hideOriginUrl"
        | "shouldIncludeDetailsInStaticExport"
    >
>

type OriginalGrapher = Pick<
    Grapher,
    | "currentTitle"
    | "shouldAddEntitySuffixToTitle"
    | "shouldAddTimeSuffixToTitle"
    | "currentSubtitle"
    | "note"
    | "originUrl"
    | "shouldIncludeDetailsInStaticExport"
    | "detailsOrderedByReference"
>

type ExportSettingsByChartId = Record<number, ExportSettings>

type Extension = "png" | "svg"
type ExportFilename = `${string}.${Extension}`

const STORAGE_KEY = "chart-export-settings"

const DEFAULT_SETTINGS: ExportSettings = {
    hideTitle: false,
    forceHideAnnotationFieldsInTitle: {
        entity: false,
        time: false,
    },
    hideSubtitle: false,
    hideNote: false,
    hideOriginUrl: false,
    shouldIncludeDetailsInStaticExport: false,
}

interface EditorExportTabProps<Editor> {
    editor: Editor
}

@observer
export class EditorExportTab<
    Editor extends AbstractChartEditor,
> extends Component<EditorExportTabProps<Editor>> {
    @observable private settings = DEFAULT_SETTINGS
    private originalSettings: Partial<ExportSettings> = DEFAULT_SETTINGS
    private originalGrapher: OriginalGrapher
    private disposers: IReactionDisposer[] = []

    constructor(props: EditorExportTabProps<Editor>) {
        super(props)
        this.originalGrapher = this.grabRelevantPropertiesFromGrapher()
    }

    componentDidMount(): void {
        this.saveOriginalSettings()

        // needs to run before settings are loaded from session storage
        const dispose = autorun(() => this.updateGrapher())

        if (sessionStorage) {
            this.loadSettingsFromSessionStorage()
        }

        this.disposers.push(dispose)
    }

    componentWillUnmount(): void {
        this.resetGrapher()

        if (sessionStorage) {
            this.saveSettingsToSessionStorage()
        }

        this.disposers.forEach((dispose) => dispose())
    }

    private loadSettingsFromSessionStorage() {
        const settingsByChartId = (loadJSONFromSessionStorage(STORAGE_KEY) ??
            {}) as ExportSettingsByChartId
        const settings = settingsByChartId[this.chartId]
        if (settings) {
            this.settings = settings
        }
    }

    private saveSettingsToSessionStorage() {
        const settingsByChartId = (loadJSONFromSessionStorage(STORAGE_KEY) ??
            {}) as ExportSettingsByChartId
        settingsByChartId[this.chartId] = this.settings
        saveJSONToSessionStorage(STORAGE_KEY, settingsByChartId)
    }

    private saveOriginalSettings() {
        this.originalSettings = {
            hideTitle: this.grapher.hideTitle,
            forceHideAnnotationFieldsInTitle:
                this.grapher.forceHideAnnotationFieldsInTitle,
            hideSubtitle: this.grapher.hideSubtitle,
            hideNote: this.grapher.hideNote,
            hideOriginUrl: this.grapher.hideOriginUrl,
            shouldIncludeDetailsInStaticExport:
                this.grapher.shouldIncludeDetailsInStaticExport,
        }
    }

    // a deep clone of Grapher would be simpler and cleaner, but takes too long
    private grabRelevantPropertiesFromGrapher(): OriginalGrapher {
        return {
            currentTitle: this.grapher.currentTitle,
            shouldAddEntitySuffixToTitle:
                this.grapher.shouldAddEntitySuffixToTitle,
            shouldAddTimeSuffixToTitle: this.grapher.shouldAddTimeSuffixToTitle,
            currentSubtitle: this.grapher.currentSubtitle,
            note: this.grapher.note,
            originUrl: this.grapher.originUrl,
            shouldIncludeDetailsInStaticExport:
                this.grapher.shouldIncludeDetailsInStaticExport,
            detailsOrderedByReference: this.grapher.detailsOrderedByReference,
        }
    }

    private resetGrapher() {
        Object.assign(this.grapher, this.originalSettings)
    }

    private updateGrapher() {
        Object.assign(this.grapher, this.settings)
    }

    @computed private get grapher(): Grapher {
        return this.props.editor.grapher
    }

    @computed private get chartId(): number {
        // the id is undefined for unsaved charts
        return this.grapher.id ?? 0
    }

    @computed private get baseFilename(): string {
        return this.props.editor.grapher.displaySlug
    }

    @action.bound private onDownloadDesktopSVG() {
        void this.download(`${this.baseFilename}-desktop.svg`, {
            format: GrapherStaticFormat.landscape,
        })
    }

    @action.bound private onDownloadDesktopPNG() {
        void this.download(`${this.baseFilename}-desktop.png`, {
            format: GrapherStaticFormat.landscape,
        })
    }

    @action.bound private onDownloadMobileSVG() {
        void this.download(`${this.baseFilename}-mobile.svg`, {
            format: GrapherStaticFormat.square,
        })
    }

    @action.bound private onDownloadMobilePNG() {
        void this.download(`${this.baseFilename}-mobile.png`, {
            format: GrapherStaticFormat.square,
        })
    }

    @action.bound private onDownloadMobileSVGForSocialMedia() {
        void this.download(`${this.baseFilename}-instagram.svg`, {
            format: GrapherStaticFormat.square,
            isSocialMediaExport: true,
        })
    }

    private async download(
        filename: ExportFilename,
        {
            format,
            isSocialMediaExport = false,
        }: {
            format: GrapherStaticFormat
            isSocialMediaExport?: boolean
        }
    ) {
        try {
            let grapher = this.grapher
            if (
                this.grapher.staticFormat !== format ||
                this.grapher.isSocialMediaExport !== isSocialMediaExport
            ) {
                grapher = new Grapher({
                    ...this.grapher,
                    staticFormat: format,
                    selectedEntityNames:
                        this.grapher.selection.selectedEntityNames,
                    focusedSeriesNames: this.grapher.focusedSeriesNames,
                    isSocialMediaExport,
                })
            }
            const { blob: pngBlob, svgBlob } = await grapher.rasterize()
            if (filename.endsWith("svg") && svgBlob) {
                triggerDownloadFromBlob(filename, svgBlob)
            } else if (filename.endsWith("png") && pngBlob) {
                triggerDownloadFromBlob(filename, pngBlob)
            }
        } catch (err) {
            console.error(err)
        }
    }

    render() {
        return (
            <div className="EditorExportTab">
                <Section name="Displayed elements">
                    {this.originalGrapher.currentTitle && (
                        <Toggle
                            label="Title"
                            value={!this.settings.hideTitle}
                            onValue={(value) =>
                                (this.settings.hideTitle = !value)
                            }
                        />
                    )}
                    {this.originalGrapher.currentTitle &&
                        this.originalGrapher.shouldAddEntitySuffixToTitle && (
                            <Toggle
                                label="Title suffix: automatic entity"
                                value={
                                    !this.settings
                                        .forceHideAnnotationFieldsInTitle
                                        ?.entity
                                }
                                onValue={(value) =>
                                    (this.settings.forceHideAnnotationFieldsInTitle.entity =
                                        !value)
                                }
                            />
                        )}
                    {this.originalGrapher.currentTitle &&
                        this.originalGrapher.shouldAddTimeSuffixToTitle && (
                            <Toggle
                                label="Title suffix: automatic time"
                                value={
                                    !this.settings
                                        .forceHideAnnotationFieldsInTitle?.time
                                }
                                onValue={(value) =>
                                    (this.settings.forceHideAnnotationFieldsInTitle.time =
                                        !value)
                                }
                            />
                        )}
                    {this.originalGrapher.currentSubtitle && (
                        <Toggle
                            label="Subtitle"
                            value={!this.settings.hideSubtitle}
                            onValue={(value) =>
                                (this.settings.hideSubtitle = !value)
                            }
                        />
                    )}
                    {this.originalGrapher.note && (
                        <Toggle
                            label="Note"
                            value={!this.settings.hideNote}
                            onValue={(value) =>
                                (this.settings.hideNote = !value)
                            }
                        />
                    )}
                    {this.originalGrapher.originUrl && (
                        <Toggle
                            label="Origin URL"
                            value={!this.settings.hideOriginUrl}
                            onValue={(value) =>
                                (this.settings.hideOriginUrl = !value)
                            }
                        />
                    )}
                    {this.originalGrapher.detailsOrderedByReference.length >
                        0 && (
                        <Toggle
                            label="Details on demand"
                            value={
                                this.settings.shouldIncludeDetailsInStaticExport
                            }
                            onValue={(value) =>
                                (this.settings.shouldIncludeDetailsInStaticExport =
                                    value)
                            }
                        />
                    )}
                </Section>
                <Section name="Export static chart">
                    <div className="DownloadButtons">
                        <button
                            className="btn btn-primary"
                            onClick={this.onDownloadDesktopPNG}
                        >
                            Download Desktop PNG
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={this.onDownloadDesktopSVG}
                        >
                            Download Desktop SVG
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={this.onDownloadMobilePNG}
                        >
                            Download Mobile PNG
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={this.onDownloadMobileSVG}
                        >
                            Download Mobile SVG
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={this.onDownloadMobileSVGForSocialMedia}
                        >
                            Download Mobile SVG for Social Media
                        </button>
                    </div>
                </Section>
            </div>
        )
    }
}

function loadJSONFromSessionStorage(key: string): unknown | undefined {
    const rawJSON = sessionStorage.getItem(key)
    if (!rawJSON) return undefined
    try {
        return JSON.parse(rawJSON)
    } catch (err) {
        console.error(err)
        return undefined
    }
}

function saveJSONToSessionStorage(key: string, value: any) {
    sessionStorage.setItem(key, JSON.stringify(value))
}
