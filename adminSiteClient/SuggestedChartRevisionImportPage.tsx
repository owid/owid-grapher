import * as React from "react"
import { observable, computed, action, runInAction } from "mobx"
import { observer } from "mobx-react"
import { Link } from "react-router-dom"
import parse from "csv-parse"
import { AdminLayout } from "./AdminLayout"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext"
import { TextField } from "./Forms"
import { capitalize } from "../clientUtils/Util"
import { GrapherInterface } from "../grapher/core/GrapherInterface"

interface ResponseMessage {
    type: string
    text: string
}

@observer
export class SuggestedChartRevisionImportPage extends React.Component {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable csv?: CSV
    @observable suggestedReason?: string
    @observable messages?: ResponseMessage[]
    @observable submitted: boolean = false

    @action.bound onCSV(csv: CSV) {
        console.log(csv.rows.length)
        this.csv = csv
        this.messages = []
    }

    @computed get suggestedConfigs(): GrapherInterface[] | undefined {
        const { csv } = this
        if (!csv) return

        const headingRow = csv.rows[0]
        const suggestedConfigs: Array<GrapherInterface> = []
        for (let i = 1; i < csv.rows.length; i++) {
            const suggestedConfig: any = {}
            const row = csv.rows[i]
            for (let j = 0; j < row.length; j++) {
                const field = headingRow[j]
                suggestedConfig[field] = row[j]
            }
            suggestedConfigs.push(suggestedConfig)
        }
        return suggestedConfigs
    }

    @computed get canSubmit(): boolean {
        return (
            !!this.csv &&
            !!this.suggestedConfigs &&
            this.suggestedConfigs.length > 0
        )
    }

    @action.bound onSuggestedReasonInput(input: string) {
        this.suggestedReason = input
    }

    @action.bound onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (this.canSubmit) {
            this.save()
            this.submitted = true
        }
    }

    @action.bound save() {
        const requestData = {
            suggestedConfigs: this.suggestedConfigs,
            suggestedReason: this.suggestedReason,
        }
        this.context.admin
            .requestJSON("/api/suggested-chart-revisions", requestData, "POST")
            .then((json: any) => {
                runInAction(() => {
                    this.messages = json.messages
                })
            })
    }

    render() {
        return (
            <AdminLayout>
                <main className="SuggestedChartRevisionImporterPage">
                    <h2>
                        Import tool for bulk chart revisions
                        <Link
                            className="btn btn-outline-primary"
                            to="/suggested-chart-revisions/review"
                            style={{ marginLeft: "10px" }}
                        >
                            Go to approval tool
                        </Link>
                        <Link
                            className="btn btn-outline-primary"
                            to="/suggested-chart-revisions"
                            style={{ marginLeft: "10px" }}
                        >
                            View all revisions
                        </Link>
                    </h2>
                    <p>
                        Use this tool when you want to make changes to a large
                        number of charts. This tool allows you to import chart
                        revisions via a csv file, which must then be approved
                        using the{" "}
                        <Link to="/suggested-chart-revisions/review">
                            chart approval tool
                        </Link>
                        .
                    </p>
                    <p className="text-danger">
                        WARNING: This tool is new and may contain bugs that
                        cause unexpected behavior. Use with caution. If you find
                        a bug, want to request a feature, or have other
                        feedback, please start a thread in{" "}
                        <a
                            href="https://owid.slack.com/messages/tech-issues/"
                            rel="noreferrer"
                            target="_blank"
                        >
                            #tech-issues
                        </a>
                        .
                    </p>
                    <Readme />
                    {this.renderForm()}
                    {this.submitted && (
                        <ResponseMessages messages={this.messages} />
                    )}
                    {this.csv && <CSVPreview csv={this.csv} />}
                </main>
            </AdminLayout>
        )
    }

    renderForm() {
        const {
            onCSV,
            onSubmit,
            canSubmit,
            suggestedReason,
            onSuggestedReasonInput,
            suggestedConfigs,
        } = this

        return (
            <section>
                <form className="import-form" onSubmit={onSubmit}>
                    <h3>Upload your chart revisions</h3>
                    <TextField
                        label="Reason for chart revisions"
                        value={suggestedReason}
                        helpText={`Main reason for suggested revisions (e.g. "Improve titles and subtitles for povcal charts")`}
                        onValue={onSuggestedReasonInput}
                    />
                    <CSVSelector onCSV={onCSV} />

                    <button
                        className="btn btn-primary"
                        key="submit"
                        type="submit"
                        title="Submit chart revisions for approval."
                        disabled={!canSubmit}
                        aria-disabled={!canSubmit}
                        style={{
                            pointerEvents: !canSubmit ? "none" : undefined,
                            marginTop: "1rem",
                        }}
                    >
                        Submit
                        {suggestedConfigs
                            ? ` ${suggestedConfigs.length} chart revisions`
                            : ""}
                    </button>
                    <div
                        className="text-muted small"
                        style={{ marginTop: "0.25rem" }}
                    >
                        By clicking "submit", your chart revisions will be added
                        to the list of{" "}
                        <Link to="/suggested-chart-revisions">
                            suggested chart revisions
                        </Link>
                        . You must then "approve" these suggested chart
                        revisions in order to apply the changes to the original
                        charts.
                    </div>
                </form>
            </section>
        )
    }
}

@observer
class Readme extends React.Component {
    @observable expanded: boolean = false

    @action.bound onToggleExpanded() {
        this.expanded = !this.expanded
    }

    render() {
        return (
            <div className="collapsible">
                <h3>
                    README
                    <button
                        className="btn btn-outline-dark"
                        type="button"
                        onClick={this.onToggleExpanded}
                        aria-expanded={this.expanded}
                        title="Show/hide README"
                        style={{ marginLeft: "10px" }}
                    >
                        {this.expanded ? "Hide" : "Show"}
                    </button>
                </h3>
                <div
                    className={`readme ${this.expanded ? "show" : "collapse"}`}
                >
                    <h5>How to use</h5>
                    <p>
                        To submit one or more chart revisions, upload a csv file
                        in which each row represents a chart and each column
                        represents a chart config field (e.g. title, subtitle,
                        timelineMinTime, ...).
                    </p>
                    <p>Example csv file:</p>
                    <pre>
                        <code>
                            # example.csv
                            <br />
                            id,version,title,subtitle,sourceDesc,note,timelineMinTime,timelineMaxTime
                            <br />
                            4765,7,New title,New subtitle,New source
                            description,New footnote,1950,2019
                            <br />
                            4766,7,,null,another new source description,another
                            new footnote,,
                        </code>
                    </pre>
                    <h5>Important things to know</h5>
                    <ul>
                        <li>
                            <b>Required CSV columns:</b> The csv file must
                            contain the following columns:
                            <ul>
                                <li>
                                    <code>id</code>: represents a chart's id in
                                    the OWID database.
                                </li>
                                <li>
                                    <code>version</code>: represents a chart's
                                    version at{" "}
                                    <i>
                                        the time you retrieved it from the OWID
                                        database
                                    </i>
                                    . The version number is used to retrieve the
                                    corresponding chart config that is to be
                                    revised, so this version number MUST match
                                    an existing or old version of the
                                    corresponding chart (otherwise you will
                                    receive an error).
                                </li>
                            </ul>
                        </li>
                        <li>
                            <b>Empty cells:</b> Empty csv cells will leave the
                            field unchanged. e.g. in example.csv, the{" "}
                            <code>title</code>, <code>timelineMinTime</code>,
                            and <code>timelineMaxTime</code> fields will be left
                            unchanged.
                        </li>
                        <li>
                            <b>Null cells:</b> The following csv values will be
                            converted to <code>null</code>:{" "}
                            <code>["null", "nan", "na"]</code>. e.g. in
                            example.csv, the <code>subtitle</code> field for
                            chart <code>4766</code> will be set to{" "}
                            <code>null</code>.
                        </li>
                        <li>
                            <b>Valid chart field names:</b> All valid chart
                            field names are listed in the{" "}
                            <a
                                href="https://github.com/owid/owid-grapher/blob/master/grapher/core/GrapherInterface.ts"
                                target="_blank"
                                rel="noreferrer"
                            >
                                GrapherInterface
                            </a>{" "}
                            interface. You can view example chart configs by
                            visiting any OWID chart (e.g.{" "}
                            <a
                                href="https://ourworldindata.org/grapher/population"
                                target="_blank"
                                rel="noreferrer"
                            >
                                population
                            </a>
                            ), opening the developer tools, and then typing
                            either <code>grapher.legacyConfigAsAuthored</code>{" "}
                            or <code>jsonConfig</code> in the console.
                        </li>
                        <li>
                            <b>Leaving a field unchanged:</b> If you wish to
                            leave a field unchanged, then you must either:
                            <ul>
                                <li>
                                    NOT include the field as a column in the csv
                                    (e.g. do not include a "title" column in the
                                    csv if you do not want to change the title
                                    on any charts);
                                </li>
                                <li>leave the cell blank; or</li>
                                <li>
                                    all cell values in the corresponding column
                                    must match the chart's current value (e.g.
                                    all titles in the "title" column must match
                                    each chart's current title).
                                </li>
                            </ul>
                            In example.csv above, all fields other than "title",
                            "subtitle", "sourceDesc", "note", "timelineMinTime",
                            and "timelineMaxTime" will be unchanged. For chart{" "}
                            <code>4766</code>, the <code>title</code>,{" "}
                            <code>timelineMinTime</code> and{" "}
                            <code>timelineMaxTime</code> fields will not be
                            changed.
                        </li>
                    </ul>

                    <h5>Terminology</h5>
                    <ul>
                        <li>
                            <b>Suggested chart revision.</b> A suggested chart
                            revision is simply an amended OWID chart, but where
                            the amendments have not yet been applied to the
                            chart in question. A suggested chart revision is
                            housed in the <code>suggested_chart_revisions</code>{" "}
                            table in <code>MySQL</code>. If the suggested chart
                            revision gets approved, then the amendments are
                            applied to the chart (which overwrites and
                            republishes the chart).
                        </li>
                    </ul>
                </div>
            </div>
        )
    }
}

@observer
class CSVSelector extends React.Component<{
    onCSV: (csv: CSV) => void
}> {
    fileInput?: HTMLInputElement

    @action.bound onChooseCSV({ target }: { target: HTMLInputElement }) {
        const file = target.files && target.files[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (e) => {
            const csv = e?.target?.result
            if (csv && typeof csv === "string") {
                parse(
                    csv,
                    {
                        relax_column_count: true,
                        skip_empty_lines: true,
                        rtrim: true,
                    },
                    (_, rows) => {
                        const csv: CSV = new CSV({
                            filename: file.name,
                            rows,
                        } as any)
                        this.props.onCSV(csv)
                    }
                )
            } else {
                console.error("CSV was falsy")
            }
        }
        reader.readAsText(file)
    }

    render() {
        return (
            <div>
                <label htmlFor="file">Upload CSV</label>
                <br />
                <input
                    id="file"
                    type="file"
                    onChange={this.onChooseCSV}
                    ref={(e) => (this.fileInput = e as HTMLInputElement)}
                />
                <div
                    className="text-muted small"
                    style={{ marginTop: "0.25rem" }}
                >
                    See README for example CSV. Maximum file size: 10MB.
                </div>
            </div>
        )
    }

    componentDidMount() {
        if (this.fileInput) this.fileInput.value = ""
    }
}

class CSV {
    filename: string
    rows: string[][]

    constructor({ filename = "", rows = [] }) {
        this.filename = filename
        this.rows = rows
    }
}

@observer
class CSVPreview extends React.Component<{ csv: CSV }> {
    // @observable maxVisibleRows: number = 11
    @observable maxRenderRows: number = 1001

    @computed get numRows(): number {
        return this.props.csv.rows.length
    }

    // @computed get numVisibleRows(): number {
    //     return Math.min(this.numRows, this.maxVisibleRows)
    // }

    @computed get numRenderRows(): number {
        return Math.min(this.numRows, this.maxRenderRows)
    }

    // number of rows of data, excluding heading row
    @computed get numDataRows(): number {
        return Math.max(0, this.numRows - 1)
    }

    render() {
        const { rows, filename } = this.props.csv
        const { numRows, numDataRows, numRenderRows, maxRenderRows } = this
        const height = 50

        return (
            <section>
                <h5>Preview of suggested chart revisions</h5>
                <div>
                    {numDataRows} chart revisions found in{" "}
                    <code>{filename}</code>.
                    {numRows > maxRenderRows && (
                        <span>
                            {" "}
                            Only the first {maxRenderRows - 1} are displayed
                            below.
                        </span>
                    )}
                </div>
                <div
                    style={{
                        marginTop: "0.5rem",
                        marginBottom: "0.5rem",
                        // height: height * numRows,
                        maxHeight: "1000px",
                        overflowY: "scroll",
                    }}
                >
                    <div
                    // style={{
                    //     height: height * numRenderRows,
                    // }}
                    >
                        <table className="table">
                            <tbody>
                                {rows.slice(0, numRenderRows).map((row, i) => (
                                    <tr key={i}>
                                        <td>{i > 0 ? i : ""}</td>
                                        {row.map((cell, j) => (
                                            <td
                                                key={j}
                                                style={{ height: height }}
                                            >
                                                {cell}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        )
    }
}

class ResponseMessages extends React.Component<{
    messages?: ResponseMessage[]
}> {
    render() {
        const { messages } = this.props
        const divs: any[] = []
        if (messages) {
            messages.map((m, i) => {
                divs.push(
                    <div key={i} className={`message bg-${m.type}`}>
                        <h5>{capitalize(m.type)}</h5>
                        <p>{m.text}</p>
                    </div>
                )
            })
        }
        return <React.Fragment>{divs}</React.Fragment>
    }
}
