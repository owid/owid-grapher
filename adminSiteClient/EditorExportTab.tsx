import { action, computed } from "mobx"
import { observer } from "mobx-react"
import React from "react"
import { ChartEditor } from "./ChartEditor.js"
import { Section, SelectField } from "./Forms.js"
import { Grapher, GrapherStaticFormat } from "@ourworldindata/grapher"
import { Bounds, triggerDownloadFromBlob } from "@ourworldindata/utils"

const FORMAT_LABELS: Record<GrapherStaticFormat, string> = {
    [GrapherStaticFormat.portrait]: "Data insight",
    [GrapherStaticFormat.instagram]: "Instagram",
    [GrapherStaticFormat.landscape]: "Landscape",
}

type Format = "png" | "svg"
type ExportFilename = `${string}.${Format}`

@observer
export class EditorExportTab extends React.Component<{ editor: ChartEditor }> {
    @computed private get grapher(): Grapher {
        return this.props.editor.grapher
    }

    @computed private get baseFilename(): string {
        return this.props.editor.grapher.displaySlug
    }

    @action.bound onPresetChange(value: string) {
        this.props.editor.staticPreviewFormat = value as GrapherStaticFormat
    }

    @action.bound async onDownloadDesktopSVG() {
        this.download(
            `${this.baseFilename}-desktop.svg`,
            this.grapher.idealBounds
        )
    }

    @action.bound async onDownloadDesktopPNG() {
        this.download(
            `${this.baseFilename}-desktop.png`,
            this.grapher.idealBounds
        )
    }

    @action.bound async onDownloadMobileSVG() {
        this.download(
            `${this.baseFilename}-mobile.svg`,
            this.grapher.staticBounds
        )
    }

    @action.bound onDownloadMobilePNG() {
        this.download(
            `${this.baseFilename}-mobile.png`,
            this.grapher.staticBounds
        )
    }

    async download(filename: ExportFilename, bounds: Bounds) {
        try {
            const { blob: pngBlob, svgBlob } =
                await this.grapher.rasterize(bounds)
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
        const { editor } = this.props
        return (
            <div className="EditorExportTab">
                <Section name="Mobile image size">
                    <SelectField
                        label="Preset"
                        value={editor.staticPreviewFormat}
                        onValue={this.onPresetChange}
                        options={Object.keys(GrapherStaticFormat)
                            .filter(
                                (format) =>
                                    format !== GrapherStaticFormat.landscape
                            )
                            .map((format) => ({
                                value: format,
                                label: FORMAT_LABELS[
                                    format as GrapherStaticFormat
                                ],
                            }))}
                    />
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
                    </div>
                </Section>
            </div>
        )
    }
}
