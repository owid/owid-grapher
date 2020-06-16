import { extend } from "./Util"
import { Bounds } from "./Bounds"
import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { ChartConfig } from "./ChartConfig"
import { faDownload } from "@fortawesome/free-solid-svg-icons/faDownload"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { DataTable } from "./DataTable"
import { DATA_TABLE } from "settings"
import { CSVGenerator } from "./CSVGenerator"

// Client-side data export from chart
@observer
export class DataTab extends React.Component<{
    bounds: Bounds
    chart: ChartConfig
}> {
    @computed get bounds() {
        return this.props.bounds
    }

    @computed get csvGenerator(): CSVGenerator {
        return new CSVGenerator({ chart: this.props.chart })
    }

    render() {
        const { bounds } = this
        const csvGenerator = this.csvGenerator

        const externalCsvLink = this.props.chart.externalCsvLink

        return (
            <div
                className="dataTab"
                style={extend(bounds.toCSS(), { position: "absolute" })}
            >
                {DATA_TABLE ? (
                    <div
                        style={{
                            width: "100%",
                            height: "100%",
                            overflow: "auto"
                        }}
                    >
                        <DataTable chart={this.props.chart} />
                    </div>
                ) : (
                    <div style={{ maxWidth: "100%" }}>
                        <p>
                            Download a CSV file containing all data used in this
                            visualization:
                        </p>
                        <a
                            href={
                                externalCsvLink
                                    ? externalCsvLink
                                    : csvGenerator.csvDataUri
                            }
                            download={csvGenerator.csvFilename}
                            className="btn btn-primary"
                            data-track-note="chart-download-csv"
                            onClick={
                                externalCsvLink
                                    ? undefined
                                    : csvGenerator.onDownload
                            }
                        >
                            <FontAwesomeIcon icon={faDownload} />{" "}
                            {csvGenerator.csvFilename}
                        </a>
                    </div>
                )}
            </div>
        )
    }
}
