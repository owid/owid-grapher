import { IReactionDisposer, action, autorun, computed, observable } from "mobx"
import { observer } from "mobx-react"
import { Component } from "react"
import { Section, Toggle } from "./Forms.js"
import { GrapherState } from "@ourworldindata/grapher"
import {
    triggerDownloadFromBlob,
    GrapherStaticFormat,
} from "@ourworldindata/utils"
import { AbstractChartEditor } from "./AbstractChartEditor.js"
import { ETL_WIZARD_URL } from "../settings/clientSettings.js"
import { faHatWizard, faDownload } from "@fortawesome/free-solid-svg-icons"
import { Button } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import urljoin from "url-join"

type ExportSettings = Required<
    Pick<
        GrapherState,
        | "hideTitle"
        | "forceHideAnnotationFieldsInTitle"
        | "hideSubtitle"
        | "hideNote"
        | "hideOriginUrl"
        | "shouldIncludeDetailsInStaticExport"
    >
>

type OriginalGrapher = Pick<
    GrapherState,
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
            hideTitle: this.grapherState.hideTitle,
            forceHideAnnotationFieldsInTitle:
                this.grapherState.forceHideAnnotationFieldsInTitle,
            hideSubtitle: this.grapherState.hideSubtitle,
            hideNote: this.grapherState.hideNote,
            hideOriginUrl: this.grapherState.hideOriginUrl,
            shouldIncludeDetailsInStaticExport:
                this.grapherState.shouldIncludeDetailsInStaticExport,
        }
    }

    // a deep clone of Grapher would be simpler and cleaner, but takes too long
    private grabRelevantPropertiesFromGrapher(): OriginalGrapher {
        return {
            currentTitle: this.grapherState.currentTitle,
            shouldAddEntitySuffixToTitle:
                this.grapherState.shouldAddEntitySuffixToTitle,
            shouldAddTimeSuffixToTitle:
                this.grapherState.shouldAddTimeSuffixToTitle,
            currentSubtitle: this.grapherState.currentSubtitle,
            note: this.grapherState.note,
            originUrl: this.grapherState.originUrl,
            shouldIncludeDetailsInStaticExport:
                this.grapherState.shouldIncludeDetailsInStaticExport,
            detailsOrderedByReference:
                this.grapherState.detailsOrderedByReference,
        }
    }

    private resetGrapher() {
        Object.assign(this.grapherState, this.originalSettings)
    }

    private updateGrapher() {
        Object.assign(this.grapherState, this.settings)
    }

    @computed private get grapherState(): GrapherState {
        return this.props.editor.grapherState
    }

    @computed private get chartId(): number {
        // the id is undefined for unsaved charts
        return this.grapherState.id ?? 0
    }

    @computed private get baseFilename(): string {
        return this.props.editor.grapherState.displaySlug
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
            let grapherState = this.grapherState
            if (
                this.grapherState.staticFormat !== format ||
                this.grapherState.isSocialMediaExport !== isSocialMediaExport
            ) {
                grapherState = new GrapherState({
                    ...this.grapherState,
                    staticFormat: format,
                    selectedEntityNames:
                        this.grapherState.selection.selectedEntityNames,
                    focusedSeriesNames: this.grapherState.focusedSeriesNames,
                    isSocialMediaExport,
                })
            }
            const { blob: pngBlob, svgBlob } = await grapherState.rasterize()
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
        const chartAnimationUrl = new URL(
            urljoin(ETL_WIZARD_URL, "chart-animation")
        )
        if (this.grapherState.canonicalUrl)
            chartAnimationUrl.searchParams.set(
                "animation_chart_url",
                this.grapherState.canonicalUrl
            )
        chartAnimationUrl.searchParams.set("animation_skip_button", "True")
        // chartAnimationUrl.searchParams.set(
        //     "animation_chart_tab",
        //     this.grapher.tab ?? ""
        // )

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
                    {this.originalGrapher.originUrl &&
                        !this.grapherState.isStaticAndSmall && (
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
                            {<FontAwesomeIcon icon={faDownload} />} Download
                            Desktop PNG
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={this.onDownloadDesktopSVG}
                        >
                            {<FontAwesomeIcon icon={faDownload} />} Download
                            Desktop SVG
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={this.onDownloadMobilePNG}
                        >
                            {<FontAwesomeIcon icon={faDownload} />} Download
                            Mobile PNG
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={this.onDownloadMobileSVG}
                        >
                            {<FontAwesomeIcon icon={faDownload} />} Download
                            Mobile SVG
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={this.onDownloadMobileSVGForSocialMedia}
                        >
                            {<FontAwesomeIcon icon={faDownload} />} Download
                            Mobile SVG for Social Media
                        </button>
                    </div>
                </Section>

                {/* Link to Wizard dataset preview */}
                {this.grapherState.isPublished && (
                    <Section name="Animate chart">
                        <a
                            href={chartAnimationUrl.toString()}
                            target="_blank"
                            className="btn btn-tertiary"
                            rel="noopener"
                        >
                            <Button
                                type="default"
                                icon={<FontAwesomeIcon icon={faHatWizard} />}
                            >
                                Animate with Wizard
                            </Button>
                        </a>
                    </Section>
                )}
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
