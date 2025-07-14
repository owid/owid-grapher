import { action, computed } from "mobx"
import { observer } from "mobx-react"
import { Component } from "react"
import { Section } from "./Forms.js"
import {
    DEFAULT_GRAPHER_BOUNDS,
    DEFAULT_GRAPHER_BOUNDS_SQUARE,
    GrapherState,
    loadVariableDataAndMetadata,
} from "@ourworldindata/grapher"
import {
    triggerDownloadFromBlob,
    OwidVariableDataMetadataDimensions,
    OwidVariableId,
} from "@ourworldindata/utils"
import { AbstractChartEditor } from "./AbstractChartEditor.js"
import { DATA_API_URL, ETL_WIZARD_URL } from "../settings/clientSettings.js"
import { faHatWizard, faDownload } from "@fortawesome/free-solid-svg-icons"
import { Button } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import urljoin from "url-join"

type Extension = "png" | "svg"
type ExportFilename = `${string}.${Extension}`

interface EditorExportTabProps<Editor> {
    editor: Editor
}

@observer
export class EditorExportTab<
    Editor extends AbstractChartEditor,
> extends Component<EditorExportTabProps<Editor>> {
    componentDidMount(): void {
        // Show a static chart preview on the export tab
        this.grapherState.isExportingToSvgOrPng = true
    }

    componentWillUnmount(): void {
        this.grapherState.isExportingToSvgOrPng = false
    }

    @computed private get grapherState(): GrapherState {
        return this.props.editor.grapherState
    }

    @computed private get baseFilename(): string {
        return this.props.editor.grapherState.displaySlug
    }

    @action.bound private onDownloadDesktopSVG() {
        void this.download(`${this.baseFilename}-desktop.svg`, {
            format: "landscape",
        })
    }

    @action.bound private onDownloadDesktopPNG() {
        void this.download(`${this.baseFilename}-desktop.png`, {
            format: "landscape",
        })
    }

    @action.bound private onDownloadMobileSVG() {
        void this.download(`${this.baseFilename}-mobile.svg`, {
            format: "square",
        })
    }

    @action.bound private onDownloadMobilePNG() {
        void this.download(`${this.baseFilename}-mobile.png`, {
            format: "square",
        })
    }

    @action.bound private onDownloadMobileSVGForSocialMedia() {
        void this.download(`${this.baseFilename}-instagram.svg`, {
            format: "square",
            isSocialMediaExport: true,
        })
    }

    private async download(
        filename: ExportFilename,
        {
            format,
            isSocialMediaExport = false,
        }: {
            format: "landscape" | "square"
            isSocialMediaExport?: boolean
        }
    ) {
        const requestedBounds =
            format === "landscape"
                ? DEFAULT_GRAPHER_BOUNDS
                : DEFAULT_GRAPHER_BOUNDS_SQUARE

        try {
            let grapherState = this.grapherState
            if (
                !this.grapherState.staticBounds.equals(requestedBounds) ||
                this.grapherState.isSocialMediaExport !== isSocialMediaExport
            ) {
                grapherState = new GrapherState({
                    ...this.grapherState.toObject(),
                    staticBounds: requestedBounds,
                    selectedEntityNames: [
                        ...this.grapherState.selection.selectedEntityNames,
                    ],
                    focusedSeriesNames: [
                        ...this.grapherState.focusedSeriesNames,
                    ],
                    isSocialMediaExport,
                    additionalDataLoaderFn: (
                        varId: OwidVariableId
                    ): Promise<OwidVariableDataMetadataDimensions> =>
                        loadVariableDataAndMetadata(varId, DATA_API_URL, {
                            noCache: true,
                        }),
                })
                grapherState.inputTable = this.grapherState.inputTable
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
