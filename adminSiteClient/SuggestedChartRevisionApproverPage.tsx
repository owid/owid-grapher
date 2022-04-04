import React from "react"
import { observer } from "mobx-react"
import { observable, computed, action, runInAction } from "mobx"
import { Link } from "react-router-dom"
import { Base64 } from "js-base64"
import { ReactSelect as Select } from "../clientUtils/import-shims.js"
import classNames from "classnames"
import { Bounds } from "../clientUtils/Bounds.js"
import { getStylesForTargetHeight } from "../clientUtils/react-select.js"
import {
    SortOrder,
    SuggestedChartRevisionStatus,
} from "../clientUtils/owidTypes.js"
import { Grapher } from "../grapher/core/Grapher.js"
import {
    TextAreaField,
    NumberField,
    RadioGroup,
    Toggle,
    Timeago,
} from "./Forms.js"
import { PostReference } from "./ChartEditor.js"
import { AdminLayout } from "./AdminLayout.js"
import { SuggestedChartRevisionStatusIcon } from "./SuggestedChartRevisionList.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faMobile } from "@fortawesome/free-solid-svg-icons/faMobile.js"
import { faDesktop } from "@fortawesome/free-solid-svg-icons/faDesktop.js"
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons/faExternalLinkAlt.js"
import { faAngleLeft } from "@fortawesome/free-solid-svg-icons/faAngleLeft.js"
import { faAngleRight } from "@fortawesome/free-solid-svg-icons/faAngleRight.js"
import { faAngleDoubleLeft } from "@fortawesome/free-solid-svg-icons/faAngleDoubleLeft.js"
import { faAngleDoubleRight } from "@fortawesome/free-solid-svg-icons/faAngleDoubleRight.js"
import { faSortAlphaDown } from "@fortawesome/free-solid-svg-icons/faSortAlphaDown.js"
import { faSortAlphaUpAlt } from "@fortawesome/free-solid-svg-icons/faSortAlphaUpAlt.js"
import { faRandom } from "@fortawesome/free-solid-svg-icons/faRandom.js"
import {
    VisionDeficiency,
    VisionDeficiencySvgFilters,
    VisionDeficiencyDropdown,
    VisionDeficiencyEntity,
} from "./VisionDeficiencies.js"
import { SuggestedChartRevisionSerialized } from "./SuggestedChartRevision.js"

@observer
export class SuggestedChartRevisionApproverPage extends React.Component<{
    suggestedChartRevisionId?: number
}> {
    @observable.ref suggestedChartRevision?: SuggestedChartRevisionSerialized
    @observable.ref originalGrapherElement?: JSX.Element
    @observable.ref suggestedGrapherElement?: JSX.Element
    @observable.ref existingGrapherElement?: JSX.Element
    @observable.ref chartReferences: PostReference[] = []

    @observable rowNum: number = 1
    @observable numTotalRows: number = 0
    @observable decisionReasonInput?: string = ""

    @observable showReadme: boolean = false
    @observable showSettings: boolean = false

    @observable showPendingOnly: boolean = true
    @observable showExistingChart: boolean = false
    @observable previewMode: string = "desktop"
    @observable desktopPreviewSize: string = "normal"
    @observable sortBy: string = "updatedAt"
    @observable sortOrder: SortOrder = SortOrder.desc
    @observable previewSvgOrJson: string = "svg"
    @observable simulateVisionDeficiency?: VisionDeficiency

    @observable private _isGraphersSet = false

    static contextType = AdminAppContext
    context!: AdminAppContextType

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

    @computed get randomBtnIsDisabled() {
        return !this._isGraphersSet || this.numTotalRows <= 1
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

    @computed get updateButtonsIsDisabled() {
        return !this._isGraphersSet
    }

    @computed get approveButtonIsDisabled() {
        return (
            this.updateButtonsIsDisabled ||
            (this.suggestedChartRevision &&
                !this.suggestedChartRevision.canApprove)
        )
    }

    @computed get rejectButtonIsDisabled() {
        return (
            this.updateButtonsIsDisabled ||
            (this.suggestedChartRevision &&
                !this.suggestedChartRevision.canReject)
        )
    }

    @computed get flagButtonIsDisabled() {
        return (
            this.updateButtonsIsDisabled ||
            (this.suggestedChartRevision &&
                !this.suggestedChartRevision.canFlag)
        )
    }

    @computed get listMode() {
        const { suggestedChartRevisionId } = this.props
        return !suggestedChartRevisionId
    }

    @action.bound async refresh() {
        this.clearDecisionReasonInput()
        await this.fetchGraphers()
        await this.fetchRefs()
    }

    @action.bound async fetchGraphers() {
        const { admin } = this.context
        const { suggestedChartRevisionId } = this.props
        if (suggestedChartRevisionId === undefined) {
            const json = await admin.getJSON("/api/suggested-chart-revisions", {
                limit: 1,
                offset: this.offset,
                status:
                    this.listMode && this.showPendingOnly
                        ? SuggestedChartRevisionStatus.pending
                        : null,
                sortBy: this.sortBy,
                sortOrder: this.sortOrder,
            })
            runInAction(() => {
                this.numTotalRows = json.numTotalRows as number
                this.suggestedChartRevision = json
                    .suggestedChartRevisions[0] as SuggestedChartRevisionSerialized
            })
        } else {
            const json = await admin.getJSON(
                `/api/suggested-chart-revisions/${suggestedChartRevisionId}`
            )
            this.suggestedChartRevision = json.suggestedChartRevision
        }
        this.decisionReasonInput = this.suggestedChartRevision
            ? this.suggestedChartRevision.decisionReason ?? ""
            : ""
        this.rerenderGraphers()
    }

    @action.bound async rerenderGraphers() {
        this._isGraphersSet = false
        setTimeout(() => {
            if (this.suggestedChartRevision) {
                this._isGraphersSet = true
            }
        }, 0)
    }

    @action.bound async fetchRefs() {
        const chartId = this.suggestedChartRevision?.chartId
        const { admin } = this.context
        const json =
            chartId === undefined
                ? []
                : await admin.getJSON(`/api/charts/${chartId}.references.json`)
        this.chartReferences = json.references || []
    }

    @action.bound onApproveSuggestedChartRevision() {
        this.updateSuggestedChartRevision(
            SuggestedChartRevisionStatus.approved,
            this.decisionReasonInput
        )
    }

    @action.bound onRejectSuggestedChartRevision() {
        this.updateSuggestedChartRevision(
            SuggestedChartRevisionStatus.rejected,
            this.decisionReasonInput
        )
    }

    @action.bound onFlagSuggestedChartRevision() {
        this.updateSuggestedChartRevision(
            SuggestedChartRevisionStatus.flagged,
            this.decisionReasonInput
        )
    }

    @action.bound async updateSuggestedChartRevision(
        status: SuggestedChartRevisionStatus,
        decisionReason: string | undefined
    ) {
        this._isGraphersSet = false
        if (!this.suggestedChartRevision) return
        const { admin } = this.context
        const data = { status, decisionReason }
        await admin.requestJSON(
            `/api/suggested-chart-revisions/${this.suggestedChartRevision.id}/update`,
            data,
            "POST"
        )
        // KLUDGE to prevent error that otherwise occurs when this.refresh() is
        // called when the user is viewing the very last suggested revision.
        if (status !== SuggestedChartRevisionStatus.pending) {
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

    @action.bound onRandom() {
        if (!this.randomBtnIsDisabled) {
            this.rowNum = Math.floor(Math.random() * this.numTotalRows + 1)
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

    @action.bound onSortByChange(selected: any) {
        this.sortBy = selected.value
        this.refresh()
    }

    @action.bound onSortOrderChange(value: SortOrder) {
        this.sortOrder = value
        this.refresh()
    }

    @action.bound onToggleShowPendingOnly(value: boolean) {
        this.showPendingOnly = value
        this.refresh()
    }

    @action.bound onToggleShowExistingChart(value: boolean) {
        this.showExistingChart = value
        // this.refresh()
    }

    @action.bound onToggleShowReadme() {
        this.showReadme = !this.showReadme
    }

    @action.bound onToggleShowSettings() {
        this.showSettings = !this.showSettings
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
                    <h3>
                        Approval tool for suggested chart revisions
                        <Link
                            className="btn btn-outline-primary"
                            to="/suggested-chart-revisions"
                            style={{ marginLeft: "10px" }}
                        >
                            View all revisions
                        </Link>
                        <Link
                            className="btn btn-outline-primary"
                            to="/suggested-chart-revisions/import"
                            style={{ marginLeft: "10px" }}
                        >
                            Upload revisions
                        </Link>
                    </h3>
                    <p>
                        Use this tool to approve or reject chart revisions that
                        have been suggested by an automated bulk update script.
                        The purpose of this tool is to provide a layer of
                        quality assurance for our charts that are updated by
                        automated scripts. This tool is a work in progress.
                        Start a thread in{" "}
                        <a
                            href="https://owid.slack.com/messages/tech-issues/"
                            rel="noreferrer"
                            target="_blank"
                        >
                            #tech-issues
                        </a>{" "}
                        if you find a bug, want to request a feature, or have
                        other feedback.
                    </p>
                    <p className="text-danger">
                        WARNING: This tool is new and may contain bugs that
                        cause unexpected behavior. Use with caution.
                    </p>
                    {this.renderReadme()}
                    {this.renderSettings()}

                    {this.numTotalRows > 0 || !this.listMode ? (
                        this.renderApprovalTool()
                    ) : (
                        <div style={{ paddingBottom: 20 }}>
                            0 pending chart revisions found. All suggested chart
                            revisions have already been approved, flagged, or
                            rejected. If you wish to see all suggested chart
                            revisions, either uncheck the{" "}
                            <i>Show "pending" revisions only</i> box in the
                            Settings tab or{" "}
                            <Link to="/suggested-chart-revisions">
                                click here
                            </Link>{" "}
                            to view a complete list of suggested chart
                            revisions.
                        </div>
                    )}
                </main>
            </AdminLayout>
        )
    }

    renderApprovalTool() {
        const status =
            this.suggestedChartRevision && this.suggestedChartRevision.status
        return (
            <React.Fragment>
                {this.renderControls()}
                <h3>
                    Suggested revision{" "}
                    {this.suggestedChartRevision
                        ? this.suggestedChartRevision.id
                        : ""}
                    <span
                        className={classNames({
                            "text-primary":
                                status ===
                                SuggestedChartRevisionStatus.approved,
                            "text-danger":
                                status ===
                                SuggestedChartRevisionStatus.rejected,
                            "text-warning":
                                status === SuggestedChartRevisionStatus.flagged,
                            "text-secondary":
                                status === SuggestedChartRevisionStatus.pending,
                        })}
                        style={{ marginLeft: "20px" }}
                    >
                        {status ? (
                            <>
                                <SuggestedChartRevisionStatusIcon
                                    status={status}
                                />{" "}
                                <i>
                                    {status.charAt(0).toUpperCase() +
                                        status.slice(1)}
                                </i>
                            </>
                        ) : (
                            ""
                        )}
                    </span>
                </h3>
                {this.renderGraphers()}
                {this.renderMeta()}
            </React.Fragment>
        )
    }

    renderReadme() {
        return (
            <div className="collapsible">
                <h3>
                    README
                    <button
                        className="btn btn-outline-dark"
                        type="button"
                        onClick={this.onToggleShowReadme}
                        aria-expanded={this.showReadme}
                        title="Show/hide README"
                        style={{ marginLeft: "10px" }}
                    >
                        {this.showReadme ? "Hide" : "Show"}
                    </button>
                </h3>
                <div
                    className={`readme ${
                        this.showReadme ? "show" : "collapse"
                    }`}
                >
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
                        <li>
                            <b>Original chart.</b> The chart as it originally
                            was when the suggested chart revision was created.
                        </li>
                        <li>
                            <b>Existing chart.</b> The chart as it currently
                            exists on the OWID website.
                        </li>
                    </ul>
                    <h5>How to use</h5>
                    <p>
                        You are shown one suggested chart revision at a time,
                        alongside the corresponding original chart as it was
                        when the suggested chart revision was created.
                    </p>
                    <p>
                        For each suggested revision, choose one of the following
                        actions:
                    </p>
                    <ol>
                        <li>
                            <b>Approve the revision</b> by clicking{" "}
                            <button
                                className="btn btn-outline-primary"
                                style={{ pointerEvents: "none" }}
                                disabled={true}
                            >
                                <SuggestedChartRevisionStatusIcon
                                    status={
                                        SuggestedChartRevisionStatus.approved
                                    }
                                    setColor={false}
                                />{" "}
                                Approve
                            </button>
                            . This approves the suggestion, replacing the
                            original chart with the suggested chart (also
                            republishes the chart). Note: if a chart has been
                            edited since the suggested revision was created, you
                            will not be allowed to approve the suggested
                            revision.
                        </li>
                        <li>
                            <b>Reject the suggested revision</b> by clicking{" "}
                            <button
                                className="btn btn-outline-danger btn"
                                style={{ pointerEvents: "none" }}
                                disabled={true}
                            >
                                <SuggestedChartRevisionStatusIcon
                                    status={
                                        SuggestedChartRevisionStatus.rejected
                                    }
                                    setColor={false}
                                />{" "}
                                Reject
                            </button>
                            . This rejects the suggestion, keeping the original
                            chart as it is.
                        </li>
                        <li>
                            <b>Flag the suggested revision</b> for further
                            inspection by clicking{" "}
                            <button
                                className="btn btn-outline-warning btn"
                                style={{ pointerEvents: "none" }}
                                disabled={true}
                            >
                                <SuggestedChartRevisionStatusIcon
                                    status={
                                        SuggestedChartRevisionStatus.flagged
                                    }
                                    setColor={false}
                                />{" "}
                                Flag
                            </button>
                            .
                        </li>
                        <li>
                            <b>Edit the original chart</b> by clicking{" "}
                            <Link
                                className="btn btn-outline-secondary"
                                to=""
                                style={{ pointerEvents: "none" }}
                            >
                                Edit{" "}
                                <FontAwesomeIcon icon={faExternalLinkAlt} />
                            </Link>
                            . This opens the original chart in the chart editor.
                            If you save your changes to the original chart
                            within the chart editor, you will no longer have the
                            option to approve the suggested revision.
                        </li>
                        <li>
                            <b>
                                Edit the suggested chart revision as the
                                original chart
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
                            . This opens the suggested chart revision in the
                            chart editor. If you make changes to the chart
                            within the chart editor,{" "}
                            <i>
                                your changes will overwrite the original chart,
                                but will NOT overwrite the suggested revision.
                            </i>{" "}
                            If you save your changes within the chart editor,
                            you will no longer have the option to approve the
                            suggested revision.
                        </li>
                    </ol>
                    <h5>Other useful information</h5>
                    <ul>
                        <li>
                            When you click the{" "}
                            <button
                                className="btn btn-outline-primary"
                                style={{ pointerEvents: "none" }}
                                disabled={true}
                            >
                                <SuggestedChartRevisionStatusIcon
                                    status={
                                        SuggestedChartRevisionStatus.approved
                                    }
                                    setColor={false}
                                />{" "}
                                Approve
                            </button>{" "}
                            ,{" "}
                            <button
                                className="btn btn-outline-danger btn"
                                style={{ pointerEvents: "none" }}
                                disabled={true}
                            >
                                <SuggestedChartRevisionStatusIcon
                                    status={
                                        SuggestedChartRevisionStatus.rejected
                                    }
                                    setColor={false}
                                />{" "}
                                Reject
                            </button>{" "}
                            or{" "}
                            <button
                                className="btn btn-outline-warning btn"
                                style={{ pointerEvents: "none" }}
                                disabled={true}
                            >
                                <SuggestedChartRevisionStatusIcon
                                    status={
                                        SuggestedChartRevisionStatus.flagged
                                    }
                                    setColor={false}
                                />{" "}
                                Flag
                            </button>{" "}
                            button, anything you write in the "Notes" text field
                            will be saved. You can view these saved notes in the
                            "Decision reason" column{" "}
                            <Link to="/suggested-chart-revisions">here</Link>.
                            If you reject or flag a suggested chart revision, it
                            is <i>strongly recommended</i> that you describe
                            your reasoning in the "Notes" field.
                        </li>
                        <li>
                            If a suggested revision has been approved and the
                            chart has not changed since the revision was
                            approved, then you can undo the revision by clicking
                            the{" "}
                            <button
                                className="btn btn-outline-danger btn"
                                style={{ pointerEvents: "none" }}
                                disabled={true}
                            >
                                <SuggestedChartRevisionStatusIcon
                                    status={
                                        SuggestedChartRevisionStatus.rejected
                                    }
                                    setColor={false}
                                />{" "}
                                Reject
                            </button>{" "}
                            button.
                        </li>
                        <li>
                            If a suggested revision has been rejected and the
                            chart has not changed since the revision was
                            rejected, then you can still approve the revision by
                            clicking the{" "}
                            <button
                                className="btn btn-outline-primary btn"
                                style={{ pointerEvents: "none" }}
                                disabled={true}
                            >
                                <SuggestedChartRevisionStatusIcon
                                    status={
                                        SuggestedChartRevisionStatus.approved
                                    }
                                    setColor={false}
                                />{" "}
                                Approve
                            </button>{" "}
                            button.
                        </li>
                        <li>
                            If one or more of the{" "}
                            <button
                                className="btn btn-outline-primary"
                                style={{ pointerEvents: "none" }}
                                disabled={true}
                            >
                                <SuggestedChartRevisionStatusIcon
                                    status={
                                        SuggestedChartRevisionStatus.approved
                                    }
                                    setColor={false}
                                />{" "}
                                Approve
                            </button>{" "}
                            ,{" "}
                            <button
                                className="btn btn-outline-danger btn"
                                style={{ pointerEvents: "none" }}
                                disabled={true}
                            >
                                <SuggestedChartRevisionStatusIcon
                                    status={
                                        SuggestedChartRevisionStatus.rejected
                                    }
                                    setColor={false}
                                />{" "}
                                Reject
                            </button>{" "}
                            or{" "}
                            <button
                                className="btn btn-outline-warning btn"
                                style={{ pointerEvents: "none" }}
                                disabled={true}
                            >
                                <SuggestedChartRevisionStatusIcon
                                    status={
                                        SuggestedChartRevisionStatus.flagged
                                    }
                                    setColor={false}
                                />{" "}
                                Flag
                            </button>{" "}
                            buttons are disabled, this is because these actions
                            are not allowed for the suggested revision in
                            question. For example, if a chart has changed since
                            the suggested revision was created, you will not be
                            allowed to approve the revision.
                        </li>
                    </ul>
                </div>
            </div>
        )
    }

    renderSettings() {
        return (
            <div className="collapsible">
                <h3>
                    Settings
                    <button
                        className="btn btn-outline-dark"
                        type="button"
                        aria-expanded={this.showSettings}
                        onClick={this.onToggleShowSettings}
                        title="Show/hide settings"
                        style={{ marginLeft: "10px" }}
                    >
                        {this.showSettings ? "Hide" : "Show"}
                    </button>
                </h3>
                <div
                    className={`settings ${
                        this.showSettings ? "show" : "collapse"
                    }`}
                >
                    {this.listMode && (
                        <div>
                            <Toggle
                                value={this.showPendingOnly}
                                onValue={this.onToggleShowPendingOnly}
                                label='Show "pending" revisions only'
                            />
                        </div>
                    )}
                    <div>
                        <Toggle
                            value={this.showExistingChart}
                            onValue={this.onToggleShowExistingChart}
                            label="Show existing chart (as it appears on the OWID site)"
                        />
                    </div>
                    <div className="flex-row">
                        <div style={{ marginRight: "20px" }}>
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
                    </div>
                    {this.listMode && (
                        <div className="flex-row">
                            <div style={{ width: 250, marginRight: "10px" }}>
                                Sort by:{" "}
                                <Select
                                    options={[
                                        {
                                            value: "id",
                                            label: "Suggestion ID",
                                        },
                                        {
                                            value: "updatedAt",
                                            label: "Date suggestion last updated",
                                        },
                                        {
                                            value: "createdAt",
                                            label: "Date suggestion created",
                                        },
                                        {
                                            value: "status",
                                            label: "Suggestion status",
                                        },
                                        {
                                            value: "suggestedReason",
                                            label: "Reason suggested",
                                        },
                                        {
                                            value: "chartUpdatedAt",
                                            label: "Date chart last updated",
                                        },
                                        {
                                            value: "chartCreatedAt",
                                            label: "Date chart created",
                                        },
                                        {
                                            value: "chartId",
                                            label: "Chart ID",
                                        },
                                        {
                                            value: "variableId",
                                            label: "Variable ID",
                                        },
                                    ]}
                                    onChange={this.onSortByChange}
                                    defaultValue={{
                                        value: "updatedAt",
                                        label: "Date suggestion last updated",
                                    }}
                                    menuPlacement="top"
                                    styles={getStylesForTargetHeight(30)}
                                />
                            </div>
                            <div>
                                <br />
                                <div
                                    className="btn-group"
                                    data-toggle="buttons"
                                    style={{ whiteSpace: "nowrap" }}
                                >
                                    <label
                                        className={
                                            "btn btn-light" +
                                            (this.sortOrder === SortOrder.asc
                                                ? " active"
                                                : "")
                                        }
                                        title="Sort ascending"
                                    >
                                        <input
                                            type="radio"
                                            onChange={() =>
                                                this.onSortOrderChange(
                                                    SortOrder.asc
                                                )
                                            }
                                            name="sortOrder"
                                            id="asc"
                                            checked={
                                                this.sortOrder === SortOrder.asc
                                            }
                                        />{" "}
                                        <FontAwesomeIcon
                                            icon={faSortAlphaDown}
                                        />
                                    </label>
                                    <label
                                        className={
                                            "btn btn-light" +
                                            (this.sortOrder === SortOrder.desc
                                                ? " active"
                                                : "")
                                        }
                                        title="Sort descending"
                                    >
                                        <input
                                            onChange={() =>
                                                this.onSortOrderChange(
                                                    SortOrder.desc
                                                )
                                            }
                                            type="radio"
                                            name="sortOrder"
                                            id="desc"
                                            checked={
                                                this.sortOrder ===
                                                SortOrder.desc
                                            }
                                        />{" "}
                                        <FontAwesomeIcon
                                            icon={faSortAlphaUpAlt}
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                    <div>
                        View SVG or JSON?
                        <RadioGroup
                            options={[
                                { label: "SVG", value: "svg" },
                                { label: "JSON", value: "json" },
                            ]}
                            value={this.previewSvgOrJson}
                            onChange={this.onChangePreviewSvgOrJson}
                        />
                    </div>
                    <div style={{ width: 250 }}>
                        Emulate vision deficiency:{" "}
                        <VisionDeficiencyDropdown
                            onChange={action(
                                (option: VisionDeficiencyEntity) =>
                                    (this.simulateVisionDeficiency =
                                        option.deficiency)
                            )}
                        />
                        <VisionDeficiencySvgFilters />
                    </div>
                </div>
            </div>
        )
    }

    renderGraphers() {
        return (
            <React.Fragment>
                <div className="charts-view">
                    <div
                        className="chart-view"
                        style={{
                            height: this.grapherBounds.height + 100,
                            width: this.grapherBounds.width,
                        }}
                    >
                        {this.suggestedChartRevision && (
                            <React.Fragment>
                                <div className="header">
                                    <h5>Original chart</h5>
                                    <span className="text-muted">
                                        {`(#${this.suggestedChartRevision.chartId}, V${this.suggestedChartRevision.originalConfig.version})`}
                                    </span>
                                    <Link
                                        className="btn btn-outline-secondary"
                                        to={`/charts/${this.suggestedChartRevision.chartId}/edit`}
                                        target="_blank"
                                        rel="noreferrer"
                                        title="Edit original chart in a new tab"
                                    >
                                        Edit{" "}
                                        <FontAwesomeIcon
                                            icon={faExternalLinkAlt}
                                        />
                                    </Link>
                                </div>
                                <p
                                    className="text-muted"
                                    style={{ fontWeight: 300 }}
                                >
                                    This is what the chart looked like when the
                                    suggested revision was created.
                                </p>
                            </React.Fragment>
                        )}
                        {this._isGraphersSet &&
                            this.suggestedChartRevision &&
                            this.renderGrapher(
                                this.suggestedChartRevision.originalConfig
                            )}
                    </div>
                    {this.showExistingChart && (
                        <div
                            className="chart-view"
                            style={{
                                height: this.grapherBounds.height + 100,
                                width: this.grapherBounds.width,
                            }}
                        >
                            {this.suggestedChartRevision && (
                                <React.Fragment>
                                    <div className="header">
                                        <h5>Existing chart</h5>
                                        <span className="text-muted">
                                            {`(#${this.suggestedChartRevision.chartId}, V${this.suggestedChartRevision.existingConfig.version})`}
                                        </span>
                                        <Link
                                            className="btn btn-outline-secondary"
                                            to={`/charts/${this.suggestedChartRevision.chartId}/edit`}
                                            target="_blank"
                                            rel="noreferrer"
                                            title="Edit existing chart in a new tab"
                                        >
                                            Edit{" "}
                                            <FontAwesomeIcon
                                                icon={faExternalLinkAlt}
                                            />
                                        </Link>
                                    </div>
                                    <p
                                        className="text-muted"
                                        style={{ fontWeight: 300 }}
                                    >
                                        This is what the chart looks like right
                                        now on the OWID website.
                                    </p>
                                </React.Fragment>
                            )}
                            {this._isGraphersSet &&
                                this.suggestedChartRevision &&
                                this.renderGrapher(
                                    this.suggestedChartRevision.existingConfig
                                )}
                        </div>
                    )}
                    <div
                        className="chart-view"
                        style={{
                            height: this.grapherBounds.height + 100,
                            width: this.grapherBounds.width,
                        }}
                    >
                        {this.suggestedChartRevision && (
                            <React.Fragment>
                                <div className="header">
                                    <h5>Suggested chart</h5>
                                    <span className="text-muted">
                                        {`(#${this.suggestedChartRevision.chartId}, V${this.suggestedChartRevision.suggestedConfig.version})`}
                                    </span>
                                    <Link
                                        className="btn btn-outline-secondary"
                                        to={`/charts/${
                                            this.suggestedChartRevision.chartId
                                        }/edit/${Base64.encode(
                                            JSON.stringify(
                                                this.suggestedChartRevision
                                                    .suggestedConfig
                                            )
                                        )}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        title="Edit chart in a new tab"
                                    >
                                        Edit as chart{" "}
                                        {this.suggestedChartRevision.chartId}{" "}
                                        <FontAwesomeIcon
                                            icon={faExternalLinkAlt}
                                        />
                                    </Link>
                                </div>
                                <p
                                    className="text-muted"
                                    style={{ fontWeight: 300 }}
                                >
                                    This is what the chart will look like if the
                                    suggested revision is approved.
                                </p>
                            </React.Fragment>
                        )}
                        {this._isGraphersSet &&
                            this.suggestedChartRevision &&
                            this.renderGrapher(
                                this.suggestedChartRevision.suggestedConfig
                            )}
                    </div>
                </div>
            </React.Fragment>
        )
    }

    renderMeta() {
        return (
            <React.Fragment>
                <div>
                    <h5>Metadata</h5>
                    <ul className="meta">
                        <li>
                            <b>Suggested revision ID:</b>{" "}
                            {this.suggestedChartRevision
                                ? this.suggestedChartRevision.id
                                : ""}
                        </li>
                        <li>
                            <b>Chart ID:</b>{" "}
                            {this.suggestedChartRevision
                                ? this.suggestedChartRevision.chartId
                                : ""}
                        </li>
                        <li>
                            <b>Suggested revision created:</b>{" "}
                            {this.suggestedChartRevision && (
                                <Timeago
                                    time={this.suggestedChartRevision.createdAt}
                                    by={
                                        this.suggestedChartRevision
                                            .createdByFullName
                                    }
                                />
                            )}
                        </li>

                        <li>
                            <b>Suggested revision last updated:</b>{" "}
                            {this.suggestedChartRevision?.updatedAt && (
                                <Timeago
                                    time={this.suggestedChartRevision.updatedAt}
                                    by={
                                        this.suggestedChartRevision
                                            .updatedByFullName ??
                                        this.suggestedChartRevision
                                            .createdByFullName
                                    }
                                />
                            )}
                        </li>
                        <li>
                            <b>Reason for suggested revision:</b>{" "}
                            {this.suggestedChartRevision &&
                            this.suggestedChartRevision.suggestedReason
                                ? this.suggestedChartRevision.suggestedReason
                                : "None provided."}
                        </li>
                    </ul>
                </div>
                <div className="references">
                    <h5>References to original chart</h5>
                    {this.renderReferences()}
                </div>
            </React.Fragment>
        )
    }

    renderGrapher(grapherConfig: any) {
        return (
            <div>
                {this.previewSvgOrJson === "json" ? (
                    <div
                        className="json-view"
                        style={{
                            height: this.grapherBounds.height * 0.9,
                            maxWidth: this.grapherBounds.width,
                        }}
                    >
                        <pre>
                            <code>
                                {JSON.stringify(grapherConfig, null, 2)}
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
                        <Grapher
                            {...{
                                ...grapherConfig,
                                bounds: this.grapherBounds,
                            }}
                        />
                    </figure>
                )}
            </div>
        )
    }

    renderControls() {
        return (
            <div className="controls">
                {this.listMode && (
                    <div className="row-input">
                        <span>Suggested revision</span>
                        <NumberField
                            value={this.rowNumValid}
                            onValue={this.onRowNumInput}
                        />
                        <span>
                            of {this.numTotalRows}
                            {this.showPendingOnly ? " remaining" : ""} (
                            <Link to="/suggested-chart-revisions">
                                View all
                            </Link>
                            )
                        </span>
                    </div>
                )}
                <div className="buttons">
                    {this.listMode && (
                        <React.Fragment>
                            <button
                                className="btn btn-outline-dark"
                                onClick={this.onFirst}
                                title="Go to first suggestion"
                                disabled={this.prevBtnIsDisabled}
                                aria-disabled={this.prevBtnIsDisabled}
                                style={{
                                    pointerEvents: this.prevBtnIsDisabled
                                        ? "none"
                                        : undefined,
                                }}
                            >
                                <FontAwesomeIcon icon={faAngleDoubleLeft} />
                            </button>
                            <button
                                className="btn btn-outline-dark"
                                onClick={this.onPrev}
                                title="Go to previous suggestion"
                                disabled={this.prevBtnIsDisabled}
                                aria-disabled={this.prevBtnIsDisabled}
                                style={{
                                    pointerEvents: this.prevBtnIsDisabled
                                        ? "none"
                                        : undefined,
                                }}
                            >
                                <FontAwesomeIcon icon={faAngleLeft} />
                            </button>
                        </React.Fragment>
                    )}
                    <button
                        className="btn btn-outline-danger"
                        onClick={this.onRejectSuggestedChartRevision}
                        title="Reject the suggestion, keeping the original chart as it is"
                        disabled={this.rejectButtonIsDisabled}
                        aria-disabled={this.rejectButtonIsDisabled}
                        style={{
                            pointerEvents: this.rejectButtonIsDisabled
                                ? "none"
                                : undefined,
                        }}
                    >
                        <SuggestedChartRevisionStatusIcon
                            status={SuggestedChartRevisionStatus.rejected}
                            setColor={false}
                        />{" "}
                        Reject
                    </button>
                    <button
                        className="btn btn-outline-warning"
                        onClick={this.onFlagSuggestedChartRevision}
                        title="Flag the suggestion for further inspection, keeping the original chart as it is"
                        disabled={this.flagButtonIsDisabled}
                        aria-disabled={this.flagButtonIsDisabled}
                        style={{
                            pointerEvents: this.flagButtonIsDisabled
                                ? "none"
                                : undefined,
                        }}
                    >
                        <SuggestedChartRevisionStatusIcon
                            status={SuggestedChartRevisionStatus.flagged}
                            setColor={false}
                        />{" "}
                        Flag
                    </button>
                    <button
                        className="btn btn-outline-primary"
                        onClick={this.onApproveSuggestedChartRevision}
                        title="Approve the suggestion, replacing the original chart with the suggested chart (also republishes the chart)"
                        disabled={this.approveButtonIsDisabled}
                        aria-disabled={this.approveButtonIsDisabled}
                        style={{
                            pointerEvents: this.approveButtonIsDisabled
                                ? "none"
                                : undefined,
                        }}
                    >
                        <SuggestedChartRevisionStatusIcon
                            status={SuggestedChartRevisionStatus.approved}
                            setColor={false}
                        />{" "}
                        Approve
                    </button>
                    {this.listMode && (
                        <React.Fragment>
                            <button
                                className="btn btn-outline-dark"
                                onClick={this.onNext}
                                title="Go to next suggestion"
                                disabled={this.nextBtnIsDisabled}
                                aria-disabled={this.nextBtnIsDisabled}
                                style={{
                                    pointerEvents: this.nextBtnIsDisabled
                                        ? "none"
                                        : undefined,
                                }}
                            >
                                <FontAwesomeIcon icon={faAngleRight} />
                            </button>
                            <button
                                className="btn btn-outline-dark"
                                onClick={this.onLast}
                                title="Go to last suggestion"
                                disabled={this.nextBtnIsDisabled}
                                aria-disabled={this.nextBtnIsDisabled}
                                style={{
                                    pointerEvents: this.nextBtnIsDisabled
                                        ? "none"
                                        : undefined,
                                }}
                            >
                                <FontAwesomeIcon icon={faAngleDoubleRight} />
                            </button>
                            <button
                                className="btn btn-outline-dark"
                                onClick={this.onRandom}
                                title="Go to random suggestion"
                                disabled={this.randomBtnIsDisabled}
                                aria-disabled={this.randomBtnIsDisabled}
                                style={{
                                    pointerEvents: this.randomBtnIsDisabled
                                        ? "none"
                                        : undefined,
                                }}
                            >
                                <FontAwesomeIcon icon={faRandom} />
                            </button>
                        </React.Fragment>
                    )}
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
                {this.chartReferences.length ? (
                    <React.Fragment>
                        <p>Public pages that embed or reference this chart:</p>
                        <ul className="list-group">
                            {this.chartReferences.map((post: PostReference) => (
                                <li key={post.id} className="list-group-item">
                                    <a
                                        href={post.url}
                                        target="_blank"
                                        rel="noopener"
                                    >
                                        <strong>{post.title}</strong>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </React.Fragment>
                ) : (
                    <p>No public posts reference the original chart.</p>
                )}
            </React.Fragment>
        )
    }
}
