import { GrapherInterface } from "@ourworldindata/utils"
import { DataPageDataV2 } from "@ourworldindata/types"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faDownload } from "@fortawesome/free-solid-svg-icons"

interface DownloadSectionProps {
    slug: string
    grapherConfig: GrapherInterface
    datapageData: DataPageDataV2
}

export default function DownloadSection({
    slug,
    grapherConfig,
    datapageData,
}: DownloadSectionProps) {
    // Sample alt text - in production this would come from the chart metadata
    const altText = `A line chart showing ${datapageData.title.title} over time`

    const pngUrl = `/grapher/${slug}.png`
    const svgUrl = `/grapher/${slug}.svg`
    const csvUrl = `/grapher/${slug}.csv?v=1&csvType=full&useColumnShortNames=false`
    const metadataUrl = `/grapher/${slug}.metadata.json?v=1&csvType=full&useColumnShortNames=false`
    const fullDataUrl = `/grapher/${slug}.zip?v=1&csvType=full&useColumnShortNames=false`
    const displayedDataUrl = `/grapher/${slug}.zip?v=1&csvType=filtered&useColumnShortNames=false`

    return (
        <div className="section-wrapper grid">
            <h2
                className="download__title span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12"
                id="download"
            >
                Download
            </h2>
            <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                {/* Visualization Downloads */}
                <div className="download__subsection">
                    <h3 className="download__subsection-title">
                        Download chart as image
                    </h3>
                    <div className="download__buttons">
                        <a
                            className="download__button"
                            href={pngUrl}
                            download={`${slug}.png`}
                            title={altText}
                            data-track-note="data_page_download_png"
                        >
                            <div className="download__button-content">
                                <div className="download__button-title">
                                    Image (PNG)
                                </div>
                                <div className="download__button-description">
                                    Suitable for most uses, widely compatible
                                </div>
                            </div>
                            <FontAwesomeIcon icon={faDownload} />
                        </a>
                        <a
                            className="download__button"
                            href={svgUrl}
                            download={`${slug}.svg`}
                            data-track-note="data_page_download_svg"
                        >
                            <div className="download__button-content">
                                <div className="download__button-title">
                                    Vector graphic (SVG)
                                </div>
                                <div className="download__button-description">
                                    For high quality prints, or further editing
                                    the chart in graphics software
                                </div>
                            </div>
                            <FontAwesomeIcon icon={faDownload} />
                        </a>
                    </div>
                </div>

                {/* Data Downloads */}
                <div className="download__subsection">
                    <h3 className="download__subsection-title">
                        Download data
                    </h3>
                    <p className="download__description">
                        Download the data shown in this chart as a ZIP file
                        containing a CSV file, metadata in JSON format, and a
                        README.
                    </p>
                    <div className="download__buttons">
                        <a
                            className="download__button"
                            href={fullDataUrl}
                            data-track-note="data_page_download_full_data"
                        >
                            <div className="download__button-content">
                                <div className="download__button-title">
                                    Download full data
                                </div>
                                <div className="download__button-description">
                                    Includes all entities and time points
                                </div>
                            </div>
                            <FontAwesomeIcon icon={faDownload} />
                        </a>
                        <a
                            className="download__button"
                            href={displayedDataUrl}
                            data-track-note="data_page_download_displayed_data"
                        >
                            <div className="download__button-content">
                                <div className="download__button-title">
                                    Download displayed data
                                </div>
                                <div className="download__button-description">
                                    Includes only the entities and time points
                                    currently visible in the chart
                                </div>
                            </div>
                            <FontAwesomeIcon icon={faDownload} />
                        </a>
                    </div>
                </div>

                {/* API URLs */}
                <div className="download__subsection">
                    <h3 className="download__subsection-title">Data API</h3>
                    <p className="download__description">
                        Use these URLs to programmatically access this chart's
                        data.{" "}
                        <a
                            href="https://docs.owid.io/projects/etl/api/"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Learn more in our documentation
                        </a>
                        .
                    </p>
                    <div className="download__api-urls">
                        <div>
                            <h4 className="download__api-url-title">
                                Data URL (CSV format)
                            </h4>
                            <code className="download__api-url">{csvUrl}</code>
                        </div>
                        <div>
                            <h4 className="download__api-url-title">
                                Metadata URL (JSON format)
                            </h4>
                            <code className="download__api-url">
                                {metadataUrl}
                            </code>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
