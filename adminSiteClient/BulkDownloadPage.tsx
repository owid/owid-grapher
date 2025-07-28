import { Component } from "react"
import { observer } from "mobx-react"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"

@observer
export class BulkDownloadPage extends Component {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    override render() {
        return (
            <AdminLayout>
                <main className="BulkDownloadPage">
                    <h2>Bulk CSV downloads</h2>
                    <DownloadChartsSection />
                </main>
            </AdminLayout>
        )
    }
}

export class DownloadChartsSection extends Component {
    override render() {
        return (
            <section>
                <div>
                    <h5>
                        Download all charts{" "}
                        <a
                            className="btn btn-outline-primary"
                            style={{ marginLeft: "20px" }}
                            href="/admin/api/charts.csv"
                        >
                            Download
                        </a>
                    </h5>
                    <p>
                        Downloads a csv containing all OWID charts. Each row
                        represents a single chart. Each column represents a
                        grapher config field (e.g. title, subtitle, minTime,
                        ...) or a chart meta field (e.g. lastEditedAt, ...).
                    </p>
                    <p>
                        The csv file does NOT contain all grapher config fields
                        or all chart meta fields. If you would like additional
                        columns added to this csv, make a request in{" "}
                        <a
                            href="https://owid.slack.com/messages/tech-issues/"
                            rel="noreferrer"
                            target="_blank"
                        >
                            #tech-issues
                        </a>
                        .
                    </p>
                </div>
            </section>
        )
    }
}
