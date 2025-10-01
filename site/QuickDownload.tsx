import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faDownload } from "@fortawesome/free-solid-svg-icons"
import { DataPageDataV2 } from "@ourworldindata/types"

interface QuickDownloadProps {
    datapageData: DataPageDataV2
    slug: string
}

export default function QuickDownload({
    datapageData,
    slug,
}: QuickDownloadProps) {
    const handleDownloadFull = () => {
        const url = `/grapher/${slug}.zip?v=1&csvType=full&useColumnShortNames=false`
        window.location.href = url
    }

    const handleDownloadDisplayed = () => {
        const url = `/grapher/${slug}.zip?v=1&csvType=filtered&useColumnShortNames=false`
        window.location.href = url
    }

    const handleDownloadPng = () => {
        const url = `/grapher/${slug}.png`
        const link = document.createElement("a")
        link.href = url
        link.download = `${slug}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <div className="quick-download">
            <h3 className="quick-download__title">Quick download</h3>
            <p className="quick-download__description">
                Download the chart as an image or get the data as a ZIP file
                containing a CSV file, metadata in JSON format, and a README.
            </p>
            <div className="quick-download__buttons">
                <button
                    className="quick-download__button"
                    onClick={handleDownloadFull}
                    data-track-note="data_page_download_full"
                >
                    <div className="quick-download__button-icon">
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                        >
                            <rect
                                x="3"
                                y="3"
                                width="18"
                                height="18"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                            />
                            <line
                                x1="3"
                                y1="9"
                                x2="21"
                                y2="9"
                                stroke="currentColor"
                                strokeWidth="2"
                            />
                            <line
                                x1="3"
                                y1="15"
                                x2="21"
                                y2="15"
                                stroke="currentColor"
                                strokeWidth="2"
                            />
                        </svg>
                    </div>
                    <div className="quick-download__button-content">
                        <div className="quick-download__button-title">
                            Download full data
                        </div>
                        <div className="quick-download__button-description">
                            Includes all entities and time points
                        </div>
                    </div>
                    <div className="quick-download__button-arrow">
                        <FontAwesomeIcon icon={faDownload} />
                    </div>
                </button>
                <button
                    className="quick-download__button"
                    onClick={handleDownloadDisplayed}
                    data-track-note="data_page_download_displayed"
                >
                    <div className="quick-download__button-icon">
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                        >
                            <rect
                                x="3"
                                y="3"
                                width="8"
                                height="8"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="currentColor"
                                fillOpacity="0.2"
                            />
                            <rect
                                x="13"
                                y="3"
                                width="8"
                                height="8"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                            />
                            <rect
                                x="3"
                                y="13"
                                width="8"
                                height="8"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="currentColor"
                                fillOpacity="0.2"
                            />
                            <rect
                                x="13"
                                y="13"
                                width="8"
                                height="8"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                            />
                        </svg>
                    </div>
                    <div className="quick-download__button-content">
                        <div className="quick-download__button-title">
                            Download displayed data
                        </div>
                        <div className="quick-download__button-description">
                            Includes only visible entities and time points
                        </div>
                    </div>
                    <div className="quick-download__button-arrow">
                        <FontAwesomeIcon icon={faDownload} />
                    </div>
                </button>
                <button
                    className="quick-download__button"
                    onClick={handleDownloadPng}
                    data-track-note="data_page_download_png"
                >
                    <div className="quick-download__button-icon">
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                        >
                            <rect
                                x="3"
                                y="3"
                                width="18"
                                height="18"
                                rx="2"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                            />
                            <circle
                                cx="8.5"
                                cy="8.5"
                                r="2"
                                fill="currentColor"
                            />
                            <path
                                d="M21 15L16 10L11 15"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                            />
                            <path
                                d="M11 15L8 12L3 17"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                            />
                        </svg>
                    </div>
                    <div className="quick-download__button-content">
                        <div className="quick-download__button-title">
                            Download chart as image (PNG)
                        </div>
                        <div className="quick-download__button-description">
                            Suitable for most uses, widely compatible
                        </div>
                    </div>
                    <div className="quick-download__button-arrow">
                        <FontAwesomeIcon icon={faDownload} />
                    </div>
                </button>
            </div>
        </div>
    )
}
