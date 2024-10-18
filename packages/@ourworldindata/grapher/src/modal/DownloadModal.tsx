import React, { useCallback, useMemo, useState } from "react"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import {
    Bounds,
    DEFAULT_BOUNDS,
    isEmpty,
    triggerDownloadFromBlob,
    triggerDownloadFromUrl,
} from "@ourworldindata/utils"
import {
    Checkbox,
    OverlayHeader,
    RadioButton,
} from "@ourworldindata/components"
import { LoadingIndicator } from "../loadingIndicator/LoadingIndicator"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faDownload } from "@fortawesome/free-solid-svg-icons"
import { OwidColumnDef, GrapherStaticFormat } from "@ourworldindata/types"
import {
    BlankOwidTable,
    OwidTable,
    CoreColumn,
} from "@ourworldindata/core-table"
import { Modal } from "./Modal"
import { GrapherExport } from "../captionedChart/StaticChartRasterizer.js"
import { Tabs } from "../tabs/Tabs.js"

export interface DownloadModalManager {
    displaySlug: string
    rasterize: (bounds?: Bounds) => Promise<GrapherExport>
    staticBounds?: Bounds
    staticBoundsWithDetails?: Bounds
    staticFormat?: GrapherStaticFormat
    baseUrl?: string
    queryStr?: string
    table?: OwidTable
    yColumnsFromDimensions?: CoreColumn[]
    externalCsvLink?: string // Todo: we can ditch this once rootTable === externalCsv (currently not quite the case for Covid Explorer)
    shouldIncludeDetailsInStaticExport?: boolean
    detailsOrderedByReference?: string[]
    isDownloadModalOpen?: boolean
    frameBounds?: Bounds
    captionedChartBounds?: Bounds
    isOnChartOrMapTab?: boolean
    framePaddingVertical?: number
    showAdminControls?: boolean
    isSocialMediaExport?: boolean
}

interface DownloadModalProps {
    manager: DownloadModalManager
}

export const DownloadModal = (
    props: DownloadModalProps
): React.ReactElement => {
    const frameBounds = props.manager.frameBounds ?? DEFAULT_BOUNDS

    const modalBounds = useMemo(() => {
        const maxWidth = 640
        const padWidth = Math.max(16, (frameBounds.width - maxWidth) / 2)
        return frameBounds.padHeight(16).padWidth(padWidth)
    }, [frameBounds])

    const onDismiss = useCallback(
        () => (props.manager.isDownloadModalOpen = false),
        [props.manager]
    )

    const [activeTabIndex, setActiveTabIndex] = useState(0)

    return (
        <Modal bounds={modalBounds} onDismiss={onDismiss}>
            <div
                className="download-modal-content"
                style={{ maxHeight: modalBounds.height }}
            >
                <OverlayHeader title="Download" onDismiss={onDismiss} />
                <div className="padded">
                    <Tabs
                        variant="slim"
                        labels={[
                            { element: <>Visualization</> },
                            { element: <>Data</> },
                        ]}
                        activeIndex={activeTabIndex}
                        setActiveIndex={setActiveTabIndex}
                    />
                </div>
                <div className="scrollable padded">
                    <DownloadModalVisTab
                        {...props}
                        visible={activeTabIndex === 0}
                    />

                    <DownloadModalDataTab
                        {...props}
                        visible={activeTabIndex === 1}
                    />
                </div>
            </div>
        </Modal>
    )
}

@observer
export class DownloadModalVisTab extends React.Component<
    DownloadModalProps & { visible: boolean }
> {
    @computed private get staticBounds(): Bounds {
        return this.manager.staticBounds ?? DEFAULT_BOUNDS
    }

    @computed private get captionedChartBounds(): Bounds {
        return this.manager.captionedChartBounds ?? DEFAULT_BOUNDS
    }

    @computed private get isExportingSquare(): boolean {
        return this.manager.staticFormat === GrapherStaticFormat.square
    }

    @computed private get isSocialMediaExport(): boolean {
        return this.manager.isSocialMediaExport ?? false
    }

    @computed private get shouldIncludeDetails(): boolean {
        return !!this.manager.shouldIncludeDetailsInStaticExport
    }

    @computed private get targetBounds(): Bounds {
        return this.manager.staticBoundsWithDetails ?? this.staticBounds
    }

    @computed private get targetWidth(): number {
        return this.targetBounds.width
    }

    @computed private get targetHeight(): number {
        return this.targetBounds.height
    }

    @computed private get manager(): DownloadModalManager {
        return this.props.manager
    }

    @observable private svgBlob?: Blob
    @observable private svgPreviewUrl?: string

    @observable private pngBlob?: Blob
    @observable private pngPreviewUrl?: string

    @observable private isReady: boolean = false

    @action.bound private export(): void {
        // render the graphic then cache data-urls for display & blobs for downloads
        this.manager
            .rasterize()
            .then(({ url, blob, svgUrl, svgBlob }) => {
                this.pngPreviewUrl = url
                this.pngBlob = blob
                this.svgPreviewUrl = svgUrl
                this.svgBlob = svgBlob
                this.markAsReady()
            })
            .catch((err) => {
                console.error(JSON.stringify(err))
                this.markAsReady()
            })
    }

    @computed private get csvBlob(): Blob {
        const csv = this.inputTable.toPrettyCsv()
        return new Blob([csv], {
            type: "text/csv;charset=utf-8",
        })
    }

    @action.bound private markAsReady(): void {
        this.isReady = true
    }

    @action.bound private reset(): void {
        this.isReady = false
    }

    @computed private get fallbackPngUrl(): string {
        return `${this.manager.baseUrl || ""}.png${this.manager.queryStr || ""}`
    }
    @computed private get baseFilename(): string {
        return this.manager.displaySlug
    }

    @computed private get inputTable(): OwidTable {
        return this.manager.table ?? BlankOwidTable()
    }

    @computed private get nonRedistributableColumn(): CoreColumn | undefined {
        return this.inputTable.columnsAsArray.find(
            (col) => (col.def as OwidColumnDef).nonRedistributable
        )
    }

    // Data downloads are fully disabled if _any_ variable used is non-redistributable.
    // In the future, we would probably like to drop only the columns that are
    // non-redistributable, and allow downloading the rest in the CSV.
    // -@danielgavrilov, 2021-11-16
    @computed private get nonRedistributable(): boolean {
        return this.nonRedistributableColumn !== undefined
    }

    // There could be multiple non-redistributable variables in the chart.
    // For now, we only pick the first one to populate the link.
    // In the future, we may need to change the phrasing of the download
    // notice and provide links to all publishers.
    // -@danielgavrilov, 2021-11-16
    @computed private get nonRedistributableSourceLink(): string | undefined {
        const def = this.nonRedistributableColumn?.def as
            | OwidColumnDef
            | undefined
        if (!def) return undefined
        return (
            def.sourceLink ??
            (def.origins && def.origins.length > 0
                ? def.origins[0].urlMain
                : undefined)
        )
    }

    @action.bound private onPngDownload(): void {
        const filename = this.baseFilename + ".png"
        if (this.pngBlob) {
            triggerDownloadFromBlob(filename, this.pngBlob)
        } else {
            triggerDownloadFromUrl(filename, this.fallbackPngUrl)
        }
    }

    @action.bound private onSvgDownload(): void {
        const filename = this.baseFilename + ".svg"
        if (this.svgBlob) {
            triggerDownloadFromBlob(filename, this.svgBlob)
        }
    }

    @action.bound private onCsvDownload(): void {
        const { manager, baseFilename } = this
        const filename = baseFilename + ".csv"
        if (manager.externalCsvLink) {
            triggerDownloadFromUrl(filename, manager.externalCsvLink)
        } else {
            triggerDownloadFromBlob(filename, this.csvBlob)
        }
    }

    @action.bound private toggleExportFormat(): void {
        this.manager.staticFormat = this.isExportingSquare
            ? GrapherStaticFormat.landscape
            : GrapherStaticFormat.square
    }

    @action.bound private toggleExportForUseInSocialMedia(): void {
        this.manager.isSocialMediaExport = !this.isSocialMediaExport
    }

    @action.bound private toggleIncludeDetails(): void {
        this.manager.shouldIncludeDetailsInStaticExport =
            !this.manager.shouldIncludeDetailsInStaticExport
    }

    @computed private get hasDetails(): boolean {
        return !isEmpty(this.manager.detailsOrderedByReference)
    }

    @computed private get showExportControls(): boolean {
        return this.hasDetails || !!this.manager.showAdminControls
    }

    componentDidMount(): void {
        this.export()
    }

    render(): React.ReactElement {
        if (!this.isReady) {
            if (this.props.visible) return <LoadingIndicator color="#000" />
            else return <></>
        }

        const {
            manager,
            svgPreviewUrl,
            captionedChartBounds,
            targetWidth,
            targetHeight,
        } = this
        const pngPreviewUrl = this.pngPreviewUrl || this.fallbackPngUrl

        let previewWidth: number
        let previewHeight: number
        const boundScalar = 0.17
        if (
            captionedChartBounds.width / captionedChartBounds.height >
            targetWidth / targetHeight
        ) {
            previewHeight = Math.min(
                72,
                captionedChartBounds.height * boundScalar
            )
            previewWidth = (targetWidth / targetHeight) * previewHeight
        } else {
            previewWidth = Math.min(
                102,
                captionedChartBounds.width * boundScalar
            )
            previewHeight = (targetHeight / targetWidth) * previewWidth
        }

        const imageStyle = {
            minWidth: previewWidth,
            minHeight: previewHeight,
            maxWidth: previewWidth,
            maxHeight: previewHeight,
            opacity: this.isReady ? 1 : 0,
        }

        return (
            <div
                className="grouped-menu"
                style={{ display: this.props.visible ? undefined : "none" }}
            >
                {manager.isOnChartOrMapTab && (
                    <div className="grouped-menu-section">
                        <div className="grouped-menu-list">
                            <DownloadButton
                                title="Image (PNG)"
                                description="Suitable for most uses, widely compatible."
                                previewImageUrl={pngPreviewUrl}
                                onClick={this.onPngDownload}
                                imageStyle={imageStyle}
                                tracking="chart_download_png"
                            />
                            <DownloadButton
                                title="Vector graphic (SVG)"
                                description="For high quality prints, or further editing the chart in graphics software."
                                previewImageUrl={svgPreviewUrl}
                                onClick={this.onSvgDownload}
                                imageStyle={imageStyle}
                                tracking="chart_download_svg"
                            />
                        </div>
                        {this.showExportControls && (
                            <div className="static-exports-options">
                                {this.hasDetails && (
                                    <Checkbox
                                        checked={this.shouldIncludeDetails}
                                        label="Include terminology definitions at bottom of chart"
                                        onChange={(): void => {
                                            this.reset()
                                            this.toggleIncludeDetails()
                                            this.export()
                                        }}
                                    />
                                )}
                                {this.manager.showAdminControls && (
                                    <Checkbox
                                        checked={this.isExportingSquare}
                                        label="Square format"
                                        onChange={action((): void => {
                                            this.reset()
                                            this.toggleExportFormat()

                                            if (!this.isExportingSquare) {
                                                this.manager.isSocialMediaExport =
                                                    false
                                            }

                                            this.export()
                                        })}
                                    />
                                )}
                                {this.manager.showAdminControls && (
                                    <Checkbox
                                        checked={this.isSocialMediaExport}
                                        label="For use in social media (internal)"
                                        onChange={action((): void => {
                                            this.reset()
                                            this.toggleExportForUseInSocialMedia()

                                            // set reasonable defaults for social media exports
                                            if (this.isSocialMediaExport) {
                                                this.manager.staticFormat =
                                                    GrapherStaticFormat.square
                                                this.manager.shouldIncludeDetailsInStaticExport =
                                                    false
                                            }

                                            this.export()
                                        })}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }
}

export const DownloadModalDataTab = (
    props: DownloadModalProps & { visible: boolean }
) => {
    const { yColumnsFromDimensions } = props.manager
    const [onlyVisible, setOnlyVisible] = useState(false)
    const [shortColNames, setShortColNames] = useState(false)

    const firstYColDef = yColumnsFromDimensions?.[0].def as
        | OwidColumnDef
        | undefined

    const exLongName = firstYColDef?.name
    const exShortName = firstYColDef?.shortName

    return (
        <div style={{ display: props.visible ? undefined : "none" }}>
            <div>
                <h2>Download options</h2>
                <section>
                    <RadioButton
                        label="Download the full dataset used in this chart"
                        group="onlyVisible"
                        checked={!onlyVisible}
                        onChange={() => setOnlyVisible(false)}
                    />
                    <RadioButton
                        label="Download only the currently selected data visible in the chart"
                        group="onlyVisible"
                        checked={onlyVisible}
                        onChange={() => setOnlyVisible(true)}
                    />
                </section>
                <hr />
                <section>
                    <div>
                        <RadioButton
                            label="Verbose column names"
                            group="shortColNames"
                            checked={!shortColNames}
                            onChange={() => setShortColNames(false)}
                        />
                        <p>
                            e.g. <code>{exLongName}</code>
                        </p>
                    </div>
                    <div>
                        <RadioButton
                            label="Short column names"
                            group="shortColNames"
                            checked={shortColNames}
                            onChange={() => setShortColNames(true)}
                        />
                        <p>
                            e.g. <code>{exShortName}</code>
                        </p>
                    </div>
                </section>
            </div>
            <div className="grouped-menu-list">
                <DownloadButton
                    title="Data and metadata (ZIP)"
                    description="Download the data CSV, metadata JSON, and a README file as a ZIP archive."
                    onClick={() => void 0}
                    tracking="chart_download_zip"
                />
                <DownloadButton
                    title="Data only (CSV)"
                    description="Download only the data in CSV format."
                    onClick={() => void 0}
                    tracking="chart_download_csv"
                />
            </div>
            <details>
                <summary>
                    <h1>Code examples</h1>
                    <p>
                        Examples of how to load this data into different data
                        analysis tools.
                    </p>
                </summary>
            </details>
        </div>
    )
}

interface DownloadButtonProps {
    title: string
    description: string
    onClick: () => void
    previewImageUrl?: string
    imageStyle?: React.CSSProperties
    tracking?: string
}

function DownloadButton(props: DownloadButtonProps): React.ReactElement {
    return (
        <button
            className="grouped-menu-item"
            onClick={props.onClick}
            data-track-note={props.tracking}
        >
            {props.previewImageUrl && (
                <div className="grouped-menu-icon">
                    <img src={props.previewImageUrl} style={props.imageStyle} />
                </div>
            )}
            <div className="grouped-menu-content">
                <h4 className="grapher_body-2-semibold">{props.title}</h4>
                <p className="grapher_label-2-regular grouped-menu-content-description">
                    {props.description}
                </p>
            </div>
            <div className="grouped-menu-icon">
                <span className="download-icon">
                    <FontAwesomeIcon icon={faDownload} />
                </span>
            </div>
        </button>
    )
}
