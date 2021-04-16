import * as React from "react"
import { observer } from "mobx-react"
import { observable, computed, action, IReactionDisposer } from "mobx"
import { Link } from "react-router-dom"
import { Base64 } from "js-base64"
import { format } from "timeago.js"
import { Bounds } from "../clientUtils/Bounds"
import { Grapher } from "../grapher/core/Grapher"
import { TextAreaField, NumberField, RadioGroup } from "./Forms"
import { PostReference } from "./ChartEditor"
import { AdminLayout } from "./AdminLayout"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faMobile } from "@fortawesome/free-solid-svg-icons/faMobile"
import { faDesktop } from "@fortawesome/free-solid-svg-icons/faDesktop"
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons/faExternalLinkAlt"
import { faAngleLeft } from "@fortawesome/free-solid-svg-icons/faAngleLeft"
import { faAngleRight } from "@fortawesome/free-solid-svg-icons/faAngleRight"
import { faAngleDoubleLeft } from "@fortawesome/free-solid-svg-icons/faAngleDoubleLeft"
import { faAngleDoubleRight } from "@fortawesome/free-solid-svg-icons/faAngleDoubleRight"
import { faQuestionCircle } from "@fortawesome/free-solid-svg-icons/faQuestionCircle"
import { faCheckCircle } from "@fortawesome/free-solid-svg-icons/faCheckCircle"
import { faTimesCircle } from "@fortawesome/free-solid-svg-icons/faTimesCircle"
import { faRedo } from "@fortawesome/free-solid-svg-icons/faRedo"
import {
    VisionDeficiency,
    VisionDeficiencySvgFilters,
    VisionDeficiencyDropdown,
    VisionDeficiencyEntity,
} from "./VisionDeficiencies"

@observer
export class SuggestedChartRevisionApproverPage extends React.Component {
    @observable.ref suggestedRevision?: any
    @observable.ref existingGrapher = new Grapher()
    @observable.ref suggestedGrapher = new Grapher()
    @observable.ref existingGrapherElement?: JSX.Element
    @observable.ref suggestedGrapherElement?: JSX.Element

    @observable.ref rowNum: number = 1
    @observable.ref numTotalRows: number = 0
    @observable.ref previewMode = "mobile"
    @observable.ref desktopPreviewSize = "normal"
    @observable.ref previewSvgOrJson = "svg"
    @observable.ref isVerticalLayout: boolean = false
    @observable.ref decisionReasonInput?: string = ""

    @observable references: PostReference[] = []
    @observable simulateVisionDeficiency?: VisionDeficiency
    @observable private _isGraphersSet = false

    static filterStatus = "pending"
    static contextType = AdminAppContext
    context!: AdminAppContextType
    dispose!: IReactionDisposer

    @computed get admin() {
        return this.context.admin
    }

    @computed get offset() {
        return this.rowNumValid - 1
    }

    @computed get prevBtnIsDisabled() {
        return !this._isGraphersSet || this.rowNumValid <= 1
    }

    @computed get nextBtnIsDisabled() {
        return !this._isGraphersSet || this.rowNumValid >= this.numTotalRows
    }

    @computed get warning() {
        let warning = null
        if (!this._isGraphersSet) {
            return warning
        }
        const isExistingChartNewer =
            this.suggestedRevision.chartUpdatedAt >
            this.suggestedRevision.updatedAt
        const isExistingChartNewerVersion =
            this.suggestedRevision.existingConfig.version >=
            this.suggestedRevision.suggestedConfig.version
        if (isExistingChartNewer) {
            warning = `
                The existing chart was updated more recently than the suggested 
                revision (${format(this.suggestedRevision.chartUpdatedAt)} vs. 
                ${format(this.suggestedRevision.updatedAt)}). It is STRONGLY 
                RECOMMENDED that you REJECT this suggested revision.`
        } else if (isExistingChartNewerVersion) {
            warning = `
                The existing chart's version is greater than or equal to the 
                suggested revision's version 
                (v${this.suggestedRevision.existingConfig.version} vs. 
                v${this.suggestedRevision.suggestedConfig.version}). It is STRONGLY 
                RECOMMENDED that you REJECT this suggested revision.`
        }
        return warning
    }

    @computed get grapherBounds() {
        let bounds
        if (this.previewMode === "mobile") {
            bounds = new Bounds(0, 0, 360, 500)
        } else {
            if (this.desktopPreviewSize === "small") {
                bounds = new Bounds(0, 0, 600, 450)
            } else {
                bounds = new Bounds(0, 0, 800, 600)
            }
        }
        return bounds
    }

    @computed get rowNumValid() {
        return Math.max(Math.min(this.rowNum, this.numTotalRows), 1)
    }

    @computed get approveRejectButtonsIsDisabled() {
        return !this._isGraphersSet
    }

    @action.bound async refresh() {
        this.clearDecisionReasonInput()
        await this.fetchGraphers()
        await this.fetchRefs()
    }

    @action.bound async fetchGraphers() {
        const { admin } = this.context
        const json = await admin.getJSON("/api/suggested-chart-revisions", {
            limit: 1,
            offset: this.offset,
            status: SuggestedChartRevisionApproverPage.filterStatus,
        })
        this.numTotalRows = json.numTotalRows
        this.suggestedRevision = json.suggestedRevisions[0]
        this.rerenderGraphers()
    }

    @action.bound private loadGraphersJson() {
        if (this.suggestedRevision) {
            this.existingGrapherElement = (
                <Grapher
                    {...{
                        ...this.suggestedRevision.existingConfig,
                        bounds: this.grapherBounds,
                        // getGrapherInstance: (grapher) => {
                        //     this.existingGrapher = grapher
                        // },
                    }}
                />
            )
            this.suggestedGrapherElement = (
                <Grapher
                    {...{
                        ...this.suggestedRevision.suggestedConfig,
                        bounds: this.grapherBounds,
                        // getGrapherInstance: (grapher) => {
                        //     this.suggestedGrapher = grapher
                        // },
                    }}
                />
            )
            this._isGraphersSet = true
        }
    }

    @action.bound async rerenderGraphers() {
        this._isGraphersSet = false
        setTimeout(() => {
            this.loadGraphersJson()
        }, 0)
    }

    @action.bound async fetchRefs() {
        const chartId = this?.suggestedRevision?.chartId
        const { admin } = this.context
        const json =
            chartId === undefined
                ? []
                : await admin.getJSON(`/api/charts/${chartId}.references.json`)
        this.references = json.references || []
    }

    @action.bound onApproveSuggestedRevision() {
        this.updateSuggestedRevision("approved", this.decisionReasonInput)
    }

    @action.bound onRejectSuggestedRevision() {
        this.updateSuggestedRevision("rejected", this.decisionReasonInput)
    }

    @action.bound async updateSuggestedRevision(
        status: string,
        decisionReason: string | undefined
    ) {
        this._isGraphersSet = false
        const { admin } = this.context
        const data = { status, decisionReason }
        await admin.requestJSON(
            `/api/suggested-chart-revisions/${this.suggestedRevision.id}/update`,
            data,
            "POST"
        )
        // KLUDGE to prevent error that otherwise occurs when this.refresh() is
        // called when the user is viewing the very last suggested revision.
        if (status !== SuggestedChartRevisionApproverPage.filterStatus) {
            this.numTotalRows -= 1
        }
        this.refresh()
    }

    @action.bound onFirst() {
        if (!this.prevBtnIsDisabled) {
            this.rowNum = 1
            this.refresh()
        }
    }

    @action.bound onPrev() {
        if (!this.prevBtnIsDisabled) {
            this.rowNum = this.rowNumValid - 1
            this.refresh()
        }
    }

    @action.bound onNext() {
        if (!this.nextBtnIsDisabled) {
            this.rowNum = this.rowNumValid + 1
            this.refresh()
        }
    }

    @action.bound onLast() {
        if (!this.nextBtnIsDisabled) {
            this.rowNum = this.numTotalRows
            this.refresh()
        }
    }

    @action.bound onDecisionReasonInput(input: string) {
        this.decisionReasonInput = input
    }

    @action.bound clearDecisionReasonInput() {
        this.decisionReasonInput = ""
    }

    @action.bound onRowNumInput(input: number | undefined) {
        if (input === undefined || input === null) {
            return
        }
        this.rowNum = input
        setTimeout(() => {
            this.refresh()
        }, 100)
    }

    @action.bound onChangeDesktopPreviewSize(value: string) {
        this.desktopPreviewSize = value
        this.rerenderGraphers()
    }

    @action.bound onChangePreviewSvgOrJson(value: string) {
        this.previewSvgOrJson = value
        this.rerenderGraphers()
    }

    componentDidMount() {
        this.refresh().then(() => {
            this.admin.loadingIndicatorSetting = "off"
        })
    }

    render() {
        return (
            <AdminLayout
                title="Approval tool for suggested chart revisions"
                noSidebar
            >
                <main className="SuggestedChartRevisionApproverPage">
                    {this.renderReadme()}
                    {this.numTotalRows > 0 ? (
                        this.renderApprovalTool()
                    ) : (
                        <div style={{ paddingBottom: 20 }}>
                            0 pending chart revisions found. All suggested chart
                            revisions have already been approved or rejected.
                        </div>
                    )}
                </main>
            </AdminLayout>
        )
    }

    renderApprovalTool() {
        return (
            <React.Fragment>
                {this.renderMeta()}
                {this.renderGraphers()}
                {this.warning && (
                    <div className="warning border rounded border-danger text-danger">
                        <h5>Warning</h5>
                        <span>{this.warning}</span>
                    </div>
                )}
                {this.renderControls()}
                <section className="references">
                    <h5>References to existing chart</h5>
                    {this.references.length ? (
                        this.renderReferences()
                    ) : (
                        <p>No public posts reference the existing chart.</p>
                    )}
                </section>
            </React.Fragment>
        )
    }

    renderReadme() {
        return (
            <section className="readme">
                <h3>Approval tool for suggested chart revisions</h3>
                <p>
                    Use this tool to approve or reject chart revisions that have
                    been suggested by an automated bulk update script. The
                    purpose of this tool is to provide a layer of quality
                    assurance for our charts that are updated by automated
                    scripts. This tool is a work in progress. Start a thread in{" "}
                    <a
                        href="https://owid.slack.com/messages/tech-issues/"
                        rel="noreferrer"
                        target="_blank"
                    >
                        #tech-issues
                    </a>{" "}
                    if you find a bug, want to request a feature, or have other
                    feedback.
                </p>
                <p>
                    <Link to="/suggested-chart-revisions">
                        View all suggested revisions
                    </Link>
                </p>
                <h5>Terminology</h5>
                <ul>
                    <li>
                        <b>Existing chart.</b> An existing OWID chart, as seen
                        in <Link to="/charts">Charts</Link>. An existing chart
                        represents a single row in the <code>charts</code> table
                        in <code>MySQL</code>.
                    </li>
                    <li>
                        <b>Suggested chart revision.</b> A suggested chart
                        revision, which will not appear anywhere in{" "}
                        <Link to="/charts">Charts</Link> until the suggested
                        revision is approved. A suggested chart revision
                        represents a single row in the{" "}
                        <code>suggested_chart_revisions</code> table in{" "}
                        <code>MySQL</code>. If the suggested revision is
                        approved, the corresponding chart in the{" "}
                        <code>charts</code> table will be replaced with the
                        suggested revision.
                    </li>
                </ul>
                <h5>How to use</h5>
                You are shown one suggested chart revision at a time, alongside
                the corresponding existing chart. For each suggested revision,
                choose one of the following actions:
                <ol>
                    <li>
                        <b>Approve the suggested revision</b> by clicking{" "}
                        <button
                            className="btn btn-primary"
                            style={{ pointerEvents: "none" }}
                        >
                            Approve
                        </button>
                        . This approves the suggestion, replacing the existing
                        chart with the suggested chart (also republishes the
                        chart).
                    </li>
                    <li>
                        <b>Reject the suggested revision</b> by clicking{" "}
                        <button
                            className="btn btn-danger btn"
                            style={{ pointerEvents: "none" }}
                        >
                            Reject
                        </button>
                        . This rejects the suggestion, keeping the existing
                        chart as it is.
                    </li>
                    <li>
                        <b>Edit the existing chart</b> by clicking{" "}
                        <Link
                            className="btn btn-outline-secondary"
                            to=""
                            style={{ pointerEvents: "none" }}
                        >
                            Edit <FontAwesomeIcon icon={faExternalLinkAlt} />
                        </Link>
                        . This opens the existing chart in the chart editor. If
                        you make changes to the existing chart within the chart
                        editor, it is STRONGLY RECOMMENDED that you reject the
                        suggested revision. Otherwise, your edits may be
                        overwritten by the suggested revision that you see here.
                    </li>
                    <li>
                        <b>
                            Edit the suggested chart revision as the existing
                            chart
                        </b>{" "}
                        by clicking{" "}
                        <Link
                            className="btn btn-outline-secondary"
                            to=""
                            style={{ pointerEvents: "none" }}
                        >
                            Edit as chart [chartId]{" "}
                            <FontAwesomeIcon icon={faExternalLinkAlt} />
                        </Link>
                        . This opens the suggested chart revision in the chart
                        editor. If you make changes to the chart within the
                        chart editor,{" "}
                        <i>
                            your changes will overwrite the existing chart, but
                            will NOT overwrite the suggested revision.
                        </i>{" "}
                        So, once you are finished editing, it is STRONGLY
                        RECOMMENDED that you reject the suggested revision.
                    </li>
                </ol>
                <h5>Other useful information</h5>
                <ul>
                    <li>
                        When you click the{" "}
                        <button
                            className="btn btn-primary"
                            style={{ pointerEvents: "none" }}
                        >
                            Approve
                        </button>{" "}
                        or{" "}
                        <button
                            className="btn btn-danger btn"
                            style={{ pointerEvents: "none" }}
                        >
                            Reject
                        </button>{" "}
                        button, anything you write in the "Notes" text field
                        will be saved. You can view these saved notes in the
                        "Decision reason" column{" "}
                        <Link to="/suggested-chart-revisions">here</Link>. If
                        you reject a suggested chart revision, it is STRONGLY
                        RECOMMENDED that you describe your reasoning in the
                        "Notes" field.
                    </li>
                    <li>
                        There is currently no "undo" button. So if you
                        mistakenly approve/reject a suggested chart revision,
                        you will need to manually edit the chart to fix the
                        unintended changes.
                    </li>
                </ul>
                <h5>Settings</h5>
                <div className="settings">
                    <div>
                        Preview mode:
                        <br />
                        <div
                            className="btn-group"
                            data-toggle="buttons"
                            style={{ whiteSpace: "nowrap" }}
                        >
                            <label
                                className={
                                    "btn btn-light" +
                                    (this.previewMode === "mobile"
                                        ? " active"
                                        : "")
                                }
                                title="Mobile preview"
                            >
                                <input
                                    type="radio"
                                    onChange={action(() => {
                                        this.previewMode = "mobile"
                                        this.rerenderGraphers()
                                    })}
                                    name="previewSize"
                                    id="mobile"
                                    checked={this.previewMode === "mobile"}
                                />{" "}
                                <FontAwesomeIcon icon={faMobile} />
                            </label>
                            <label
                                className={
                                    "btn btn-light" +
                                    (this.previewMode === "desktop"
                                        ? " active"
                                        : "")
                                }
                                title="Desktop preview"
                            >
                                <input
                                    onChange={action(() => {
                                        this.previewMode = "desktop"
                                        this.rerenderGraphers()
                                    })}
                                    type="radio"
                                    name="previewSize"
                                    id="desktop"
                                    checked={this.previewMode === "desktop"}
                                />{" "}
                                <FontAwesomeIcon icon={faDesktop} />
                            </label>
                        </div>
                    </div>
                    <div>
                        Preview size (desktop only):
                        <RadioGroup
                            options={[
                                { label: "Small", value: "small" },
                                { label: "Normal", value: "normal" },
                            ]}
                            value={this.desktopPreviewSize}
                            onChange={this.onChangeDesktopPreviewSize}
                        />
                    </div>
                    <div
                        className="form-group d-inline-block"
                        style={{ width: 250 }}
                    >
                        Emulate vision deficiency:{" "}
                        <VisionDeficiencyDropdown
                            onChange={action(
                                (option: VisionDeficiencyEntity) =>
                                    (this.simulateVisionDeficiency =
                                        option.deficiency)
                            )}
                        />
                    </div>
                    <VisionDeficiencySvgFilters />
                    <div>
                        Preview chart SVG or JSON?
                        <RadioGroup
                            options={[
                                { label: "SVG", value: "svg" },
                                { label: "JSON", value: "json" },
                            ]}
                            value={this.previewSvgOrJson}
                            onChange={this.onChangePreviewSvgOrJson}
                        />
                    </div>
                </div>
            </section>
        )
    }

    renderGraphers() {
        return (
            <React.Fragment>
                <div
                    className="charts-view"
                    style={{
                        flexDirection: this.isVerticalLayout ? "column" : "row",
                    }}
                >
                    <div
                        className="chart-view"
                        style={{
                            height: this.grapherBounds.height + 70,
                            maxWidth: this.grapherBounds.width,
                        }}
                    >
                        {this._isGraphersSet && this.renderGrapher(true)}
                    </div>
                    <div
                        className="chart-view"
                        style={{
                            height: this.grapherBounds.height + 70,
                            maxWidth: this.grapherBounds.width,
                        }}
                    >
                        {this._isGraphersSet && this.renderGrapher(false)}
                    </div>
                </div>
            </React.Fragment>
        )
    }

    renderMeta() {
        return (
            <React.Fragment>
                <h3>
                    Suggested revision for chart{" "}
                    {this.suggestedRevision
                        ? this.suggestedRevision.chartId
                        : ""}
                    <button
                        className="btn btn-outline-secondary"
                        onClick={this.refresh}
                        title="Refresh the charts view"
                        style={{ marginLeft: "10px" }}
                    >
                        <FontAwesomeIcon icon={faRedo} />
                    </button>
                </h3>
                <div>
                    <ul className="meta">
                        <li>
                            <b>Suggested revision created by:</b>{" "}
                            {this.suggestedRevision
                                ? this.suggestedRevision.user
                                : ""}
                        </li>
                        <li>
                            <b>Created:</b>{" "}
                            {this.suggestedRevision
                                ? format(this.suggestedRevision.createdAt)
                                : ""}
                        </li>
                        <li>
                            <b>Last updated:</b>{" "}
                            {this.suggestedRevision
                                ? format(this.suggestedRevision.createdAt)
                                : ""}
                        </li>
                        <li>
                            <b>Reason for suggestion:</b>{" "}
                            {this.suggestedRevision &&
                            this.suggestedRevision.createdReason
                                ? this.suggestedRevision.createdReason
                                : "None provided."}
                        </li>
                        <li>
                            <b>Status:</b>{" "}
                            {this.suggestedRevision &&
                                this.suggestedRevision.status === "pending" && (
                                    <FontAwesomeIcon
                                        icon={faQuestionCircle}
                                        style={{ color: "#9E9E9E" }}
                                    />
                                )}
                            {this.suggestedRevision &&
                                this.suggestedRevision.status ===
                                    "approved" && (
                                    <FontAwesomeIcon
                                        icon={faCheckCircle}
                                        style={{ color: "#2196F3" }}
                                    />
                                )}
                            {this.suggestedRevision &&
                                this.suggestedRevision.status ===
                                    "rejected" && (
                                    <FontAwesomeIcon
                                        icon={faTimesCircle}
                                        style={{ color: "#f44336" }}
                                    />
                                )}{" "}
                            {this.suggestedRevision
                                ? this.suggestedRevision.status
                                : ""}
                        </li>
                    </ul>
                </div>
            </React.Fragment>
        )
    }

    renderGrapher(isExisting: boolean) {
        const grapherElement = isExisting
            ? this.existingGrapherElement
            : this.suggestedGrapherElement
        const header = isExisting ? "Existing chart" : "Suggested revision"
        const link = isExisting ? (
            <Link
                className="btn btn-outline-secondary"
                to={
                    this.suggestedRevision && this.suggestedRevision.chartId
                        ? `/charts/${this.suggestedRevision.chartId}/edit`
                        : ""
                }
                target="_blank"
                rel="noreferrer"
                title="Edit existing chart in a new tab"
            >
                Edit <FontAwesomeIcon icon={faExternalLinkAlt} />
            </Link>
        ) : (
            <Link
                className="btn btn-outline-secondary"
                to={`/charts/${
                    this.suggestedRevision.chartId
                }/edit/${Base64.encode(
                    JSON.stringify(this.suggestedRevision.suggestedConfig)
                )}`}
                target="_blank"
                rel="noreferrer"
                title="Edit chart in a new tab"
            >
                Edit as chart {this.suggestedRevision.chartId}{" "}
                <FontAwesomeIcon icon={faExternalLinkAlt} />
            </Link>
        )

        return (
            <React.Fragment>
                <div className="header">
                    <h5>{header}</h5>
                    {link}
                </div>
                <div>
                    {this.previewSvgOrJson === "json" ? (
                        <div
                            className="json-view"
                            style={{
                                height: this.grapherBounds.height,
                                maxWidth: this.grapherBounds.width,
                            }}
                        >
                            <pre>
                                <code>
                                    {isExisting
                                        ? JSON.stringify(
                                              this.suggestedRevision
                                                  .existingConfig,
                                              null,
                                              2
                                          )
                                        : JSON.stringify(
                                              this.suggestedRevision
                                                  .suggestedConfig,
                                              null,
                                              2
                                          )}
                                </code>
                            </pre>
                        </div>
                    ) : (
                        <figure
                            data-grapher-src
                            style={{
                                filter:
                                    this.simulateVisionDeficiency &&
                                    `url(#${this.simulateVisionDeficiency.id})`,
                            }}
                        >
                            {grapherElement}
                        </figure>
                    )}
                </div>
            </React.Fragment>
        )
    }

    renderControls() {
        return (
            <div className="controls">
                <div className="row-input">
                    <span>Suggested revision</span>
                    <NumberField
                        value={this.rowNumValid}
                        onValue={this.onRowNumInput}
                    />
                    <span>
                        of {this.numTotalRows} remaining (
                        <Link to="/suggested-chart-revisions">View all</Link>)
                    </span>
                </div>
                <div className="buttons">
                    <button
                        className="btn btn-outline-dark"
                        onClick={this.onFirst}
                        title="Go to first suggestion"
                        disabled={this.prevBtnIsDisabled}
                        aria-disabled={this.prevBtnIsDisabled}
                    >
                        <FontAwesomeIcon icon={faAngleDoubleLeft} />
                    </button>
                    <button
                        className="btn btn-outline-dark"
                        onClick={this.onPrev}
                        title="Go to previous suggestion"
                        disabled={this.prevBtnIsDisabled}
                        aria-disabled={this.prevBtnIsDisabled}
                    >
                        <FontAwesomeIcon icon={faAngleLeft} />
                    </button>
                    <button
                        className="btn btn-danger"
                        onClick={this.onRejectSuggestedRevision}
                        title="Reject the suggestion, keeping the existing chart as it is"
                        disabled={this.approveRejectButtonsIsDisabled}
                        aria-disabled={this.approveRejectButtonsIsDisabled}
                    >
                        Reject
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={this.onApproveSuggestedRevision}
                        title="Approve the suggestion, replacing the existing chart with the suggested chart (also republishes the chart)"
                        disabled={this.approveRejectButtonsIsDisabled}
                        aria-disabled={this.approveRejectButtonsIsDisabled}
                    >
                        Approve
                    </button>
                    <button
                        className="btn btn-outline-dark"
                        onClick={this.onNext}
                        title="Go to next suggestion"
                        disabled={this.nextBtnIsDisabled}
                        aria-disabled={this.nextBtnIsDisabled}
                    >
                        <FontAwesomeIcon icon={faAngleRight} />
                    </button>
                    <button
                        className="btn btn-outline-dark"
                        onClick={this.onLast}
                        title="Go to last suggestion"
                        disabled={this.nextBtnIsDisabled}
                        aria-disabled={this.nextBtnIsDisabled}
                    >
                        <FontAwesomeIcon icon={faAngleDoubleRight} />
                    </button>
                </div>
                <TextAreaField
                    label="Notes"
                    placeholder="e.g. why are you rejecting this suggested revision?"
                    value={this.decisionReasonInput}
                    onValue={this.onDecisionReasonInput}
                    disabled={!this._isGraphersSet}
                />
            </div>
        )
    }

    renderReferences() {
        return (
            <React.Fragment>
                <p>Public pages that embed or reference this chart:</p>
                <ul className="list-group">
                    {this.references.map((post) => (
                        <li key={post.id} className="list-group-item">
                            <a href={post.url} target="_blank" rel="noopener">
                                <strong>{post.title}</strong>
                            </a>
                        </li>
                    ))}
                </ul>
            </React.Fragment>
        )
    }
}
