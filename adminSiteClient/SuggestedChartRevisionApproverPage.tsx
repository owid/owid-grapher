import React from "react"
import { observer } from "mobx-react"
import { observable, computed, action, runInAction } from "mobx"
import { Link } from "react-router-dom"
import { Base64 } from "js-base64"
import Select from "react-select"
import {
    Bounds,
    getStylesForTargetHeight,
    SortOrder,
    SuggestedChartRevisionStatus,
    Tippy,
    uniqBy,
} from "@ourworldindata/utils"
import { Grapher } from "@ourworldindata/grapher"
import {
    TextAreaField,
    NumberField,
    RadioGroup,
    Toggle,
    Timeago,
} from "./Forms.js"
import { References } from "./ChartEditor.js"
import { AdminLayout } from "./AdminLayout.js"
import { SuggestedChartRevisionStatusIcon } from "./SuggestedChartRevisionList.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faMobile,
    faDesktop,
    faExternalLinkAlt,
    faAngleLeft,
    faAngleRight,
    faAngleDoubleLeft,
    faAngleDoubleRight,
    faSortAlphaDown,
    faSortAlphaUpAlt,
    faRandom,
    faMagicWandSparkles,
} from "@fortawesome/free-solid-svg-icons"
import {
    VisionDeficiency,
    VisionDeficiencySvgFilters,
    VisionDeficiencyDropdown,
    VisionDeficiencyEntity,
} from "./VisionDeficiencies.js"
import { SuggestedChartRevisionSerialized } from "./SuggestedChartRevision.js"
import { match } from "ts-pattern"
import { ReferencesSection } from "./EditorReferencesTab.js"

interface UserSelectOption {
    userName: string
    userId: number | undefined
}

@observer
export class SuggestedChartRevisionApproverPage extends React.Component<{
    suggestedChartRevisionId?: number
}> {
    @observable.ref suggestedChartRevisions?: SuggestedChartRevisionSerialized[]
    @observable currentlyActiveUserId?: number
    @observable.ref originalGrapherElement?: JSX.Element
    @observable.ref suggestedGrapherElement?: JSX.Element
    @observable.ref existingGrapherElement?: JSX.Element
    @observable.ref chartReferences: References | undefined = undefined

    // HACK: In order for the <select> dropdown to not drop any existing users after finishing all
    // their reviews, we want the list of available users to be append-only, which we achieve by
    // introducing this extra state and merging them in the `availableUsers` getter.
    _cacheAvailableUsers: UserSelectOption[] = []

    @observable rowNum: number = 1
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

    // GPT
    @observable gptNum: number = 0
    @observable gptNumDisp: number = 1
    @observable usingGPT: boolean = false

    ALL_TABS = {
        approval: "Chart Approval Tool",
        readme: "Instructions",
        settings: "Settings",
    } as const
    @observable activeTab: keyof typeof this.ALL_TABS = "approval"

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
        return (
            !this._isGraphersSet ||
            this.rowNumValid >= this.numAvailableRowsForSelectedUser
        )
    }

    @computed get randomBtnIsDisabled() {
        return !this._isGraphersSet || this.numAvailableRowsForSelectedUser <= 1
    }

    @computed get grapherBounds() {
        let bounds
        if (this.previewMode === "mobile") {
            bounds = new Bounds(0, 0, 360, 500)
        } else {
            if (this.desktopPreviewSize === "small") {
                bounds = new Bounds(0, 0, 600, 450)
            } else if (this.desktopPreviewSize === "normal") {
                bounds = new Bounds(0, 0, 800, 600)
            } else {
                bounds = new Bounds(0, 0, 1200, 900)
            }
        }
        return bounds
    }

    @computed get rowNumValid() {
        return Math.max(
            Math.min(this.rowNum, this.numAvailableRowsForSelectedUser),
            1
        )
    }

    @computed get updateButtonsIsDisabled() {
        return !this._isGraphersSet
    }

    @computed get approveButtonIsDisabled() {
        return (
            this.updateButtonsIsDisabled ||
            (this.currentSuggestedChartRevision &&
                !this.currentSuggestedChartRevision.canApprove)
        )
    }

    @computed get rejectButtonIsDisabled() {
        return (
            this.updateButtonsIsDisabled ||
            (this.currentSuggestedChartRevision &&
                !this.currentSuggestedChartRevision.canReject)
        )
    }

    @computed get flagButtonIsDisabled() {
        return (
            this.updateButtonsIsDisabled ||
            (this.currentSuggestedChartRevision &&
                !this.currentSuggestedChartRevision.canFlag)
        )
    }

    @computed get listMode() {
        const { suggestedChartRevisionId } = this.props
        return !suggestedChartRevisionId
    }

    @action.bound async refresh() {
        console.log("refresh")
        this.clearDecisionReasonInput()
        await this.fetchGraphers()
        await this.fetchRefs()
    }

    @computed get currentSuggestedChartRevision() {
        return this.availableRevisionsForCurrentUser?.[this.offset]
    }

    @action.bound async fetchGraphers() {
        console.log("fetchGraphers 1")
        const { admin } = this.context
        const json = await admin.getJSON("/api/suggested-chart-revisions", {
            status:
                this.listMode && this.showPendingOnly
                    ? SuggestedChartRevisionStatus.pending
                    : null,
            sortBy: this.sortBy,
            sortOrder: this.sortOrder,
        })
        console.log("fetchGraphers 2")
        runInAction(() => {
            this.suggestedChartRevisions =
                json.suggestedChartRevisions as SuggestedChartRevisionSerialized[]
        })
        console.log("fetchGraphers 3")
        this.decisionReasonInput = this.currentSuggestedChartRevision
            ? this.currentSuggestedChartRevision.decisionReason ?? ""
            : ""
        void this.rerenderGraphers()
        console.log("fetchGraphers 4")
    }

    @action.bound async rerenderGraphers() {
        console.log("rerenderGraphers 1")
        this._isGraphersSet = false
        setTimeout(() => {
            if (this.currentSuggestedChartRevision) {
                this._isGraphersSet = true
            }
        }, 0)
    }

    @action.bound async fetchRefs() {
        console.log("fetchRefs 1")
        const chartId = this.currentSuggestedChartRevision?.chartId
        const { admin } = this.context
        const json =
            chartId === undefined
                ? {}
                : await admin.getJSON(`/api/charts/${chartId}.references.json`)
        this.chartReferences = json.references
        console.log("fetchRefs 2")
    }

    @action.bound onApproveSuggestedChartRevision() {
        console.log("WE GETTING CLOSER 0A")
        void this.updateSuggestedChartRevision(
            SuggestedChartRevisionStatus.approved,
            this.decisionReasonInput
        )
    }

    @action.bound onRejectSuggestedChartRevision() {
        console.log("WE GETTING CLOSER 0R")
        void this.updateSuggestedChartRevision(
            SuggestedChartRevisionStatus.rejected,
            this.decisionReasonInput
        )
    }

    @action.bound onFlagSuggestedChartRevision() {
        console.log("WE GETTING CLOSER 0F")
        void this.updateSuggestedChartRevision(
            SuggestedChartRevisionStatus.flagged,
            this.decisionReasonInput
        )
    }

    @action.bound async updateSuggestedChartRevision(
        status: SuggestedChartRevisionStatus,
        decisionReason: string | undefined
    ) {
        this._isGraphersSet = false
        if (!this.currentSuggestedChartRevision) return
        const { admin } = this.context
        const suggestedConfig: object =
            this.currentSuggestedChartRevision?.suggestedConfig
        const data = { suggestedConfig, status, decisionReason }
        await admin.requestJSON(
            `/api/suggested-chart-revisions/${this.currentSuggestedChartRevision.id}/update`,
            data,
            "POST"
        )
        // KLUDGE to prevent error that otherwise occurs when this.refresh() is
        // called when the user is viewing the very last suggested revision.
        // if (status !== SuggestedChartRevisionStatus.pending) {
        //     this.numTotalRows -= 1
        // }
        this.disableChatGPT()
        void this.refresh()
    }

    @action.bound updateChartConfigWithGPT() {
        if (this.currentSuggestedChartRevision) {
            // Get suggestions
            const suggestions =
                this.currentSuggestedChartRevision?.experimental?.["gpt"]?.[
                    "suggestions"
                ]
            if (suggestions !== undefined) {
                // Set title
                const title = suggestions?.[this.gptNum]?.["title"]
                this.currentSuggestedChartRevision.suggestedConfig.title = title
                // Set subtitle
                const subtitle = suggestions?.[this.gptNum]?.["subtitle"]
                this.currentSuggestedChartRevision.suggestedConfig.subtitle =
                    subtitle
                this.gptNumDisp = this.gptNum + 1
                this.gptNum = this.gptNumDisp % suggestions?.length ?? 1
                this.usingGPT = true
            }
        }
        void this.rerenderGraphers()
    }

    @action.bound getGPTModelNameUsed(): string | undefined {
        const experimental = this.currentSuggestedChartRevision?.experimental
        const suggestions = experimental?.gpt?.suggestions

        if (
            suggestions?.every(
                (suggestion) =>
                    suggestion.title !== undefined &&
                    suggestion.subtitle !== undefined
            ) &&
            experimental?.gpt?.model
        ) {
            console.log("GPT suggestions are available!")
            return experimental.gpt.model
        }
        console.log("NO GPT FIELD")
        return undefined
    }

    @action.bound resetChartConfigWithGPT() {
        this.disableChatGPT()
        void this.refresh()
    }

    @action.bound disableChatGPT() {
        this.gptNum = 0
        this.gptNumDisp = 1
        this.usingGPT = false
    }

    @action.bound onFirst() {
        if (!this.prevBtnIsDisabled) {
            this.disableChatGPT()
            this.rowNum = 1
            void this.refresh()
        }
    }

    @action.bound onPrev() {
        if (!this.prevBtnIsDisabled) {
            this.disableChatGPT()
            this.rowNum = this.rowNumValid - 1
            void this.refresh()
        }
    }

    @action.bound onNext() {
        if (!this.nextBtnIsDisabled) {
            this.disableChatGPT()
            this.rowNum = this.rowNumValid + 1
            void this.refresh()
        }
    }

    @action.bound onLast() {
        if (!this.nextBtnIsDisabled) {
            this.disableChatGPT()
            this.rowNum = this.numAvailableRowsForSelectedUser
            void this.refresh()
        }
    }

    @action.bound onRandom() {
        if (!this.randomBtnIsDisabled) {
            this.disableChatGPT()
            this.rowNum = Math.floor(
                Math.random() * this.numAvailableRowsForSelectedUser + 1
            )
            void this.refresh()
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
            void this.refresh()
        }, 100)
    }

    @action.bound onChangeDesktopPreviewSize(value: string) {
        console.log("onChangeDesktopPreviewSize")
        this.desktopPreviewSize = value
        void this.rerenderGraphers()
    }

    @action.bound onChangePreviewSvgOrJson(value: string) {
        console.log("onChangePreviewSvgOrJson")
        this.previewSvgOrJson = value
        void this.rerenderGraphers()
    }

    @action.bound onSortByChange(selected: any) {
        this.sortBy = selected.value
        void this.refresh()
    }

    @action.bound onSortOrderChange(value: SortOrder) {
        this.sortOrder = value
        void this.refresh()
    }

    @action.bound onToggleShowPendingOnly(value: boolean) {
        this.showPendingOnly = value
        void this.refresh()
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
        void this.refresh().then(() => {
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
                    {/* Render tabs with content */}
                    {this.renderContent()}
                </main>
            </AdminLayout>
        )
    }

    renderContent() {
        // Render all tabs and their content
        const { ALL_TABS, activeTab } = this
        return (
            <div>
                <div>
                    <ul className="nav nav-tabs">
                        {Object.entries(ALL_TABS).map(([tab, displayName]) => (
                            <li key={tab} className="nav-item">
                                <a
                                    className={
                                        "nav-link" +
                                        (tab === activeTab ? " active" : "")
                                    }
                                    onClick={action(
                                        () =>
                                            (this.activeTab =
                                                tab as keyof typeof ALL_TABS)
                                    )}
                                >
                                    {displayName}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="sidebar-content">
                    {match(activeTab)
                        .with("approval", () => this.renderApprovalTool())
                        .with("readme", () => this.renderReadme())
                        .with("settings", () => this.renderSettings())
                        .otherwise(() => null)}
                </div>
            </div>
        )
    }

    @computed get availableUsers(): UserSelectOption[] {
        const availableUserAccordingToRevisions =
            this.suggestedChartRevisions?.map((revision) => ({
                userId: revision.createdById,
                userName: revision.createdByFullName,
            })) ?? []

        const merged = uniqBy(
            [
                ...this._cacheAvailableUsers,
                ...availableUserAccordingToRevisions,
            ],
            (user) => user.userId
        )
        this._cacheAvailableUsers = merged
        return merged
    }

    @computed get availableRevisionsForCurrentUser() {
        console.log(this.currentlyActiveUserId)
        if (this.currentlyActiveUserId === undefined)
            return this.suggestedChartRevisions
        return this.suggestedChartRevisions?.filter(
            (revision) => revision.createdById === this.currentlyActiveUserId
        )
    }

    @computed get numAvailableRowsForSelectedUser() {
        return this.availableRevisionsForCurrentUser?.length ?? 0
    }

    renderApprovalTool() {
        // Render the approval tool
        return (
            <div>
                {this.renderUserMenu()}
                {this.numAvailableRowsForSelectedUser > 0 || !this.listMode ? (
                    <React.Fragment>
                        {this.renderGraphers()}
                        {this.renderControls()}
                        {this.renderMeta()}
                    </React.Fragment>
                ) : (
                    <div
                        style={{
                            marginTop: "2rem",
                            padding: "1rem",
                            width: "50%",
                            border: "1px solid #ccc",
                            backgroundColor: "#FFF5D4",
                            boxShadow: "0 0 1px rgba(0,0,0,0.2)",
                        }}
                    >
                        <p>
                            ⚠️ <b>0 pending chart revisions found.</b> All
                            suggested chart revisions have already been
                            approved, flagged, or rejected.
                        </p>
                        <p>
                            If you wish to see all suggested chart revisions,
                            either uncheck the{" "}
                            <i>Show "pending" revisions only</i> box in the
                            Settings tab or{" "}
                            <Link to="/suggested-chart-revisions">
                                click here
                            </Link>{" "}
                            to view a complete list of suggested chart
                            revisions.
                        </p>
                    </div>
                )}
            </div>
        )
    }

    @action.bound onCurrentlyActiveUserChange(
        event: React.ChangeEvent<HTMLSelectElement>
    ) {
        runInAction(() => {
            this.currentlyActiveUserId =
                event.currentTarget.value === "-1"
                    ? undefined
                    : parseInt(event.currentTarget.value)

            this.rowNum = 1
        })

        void this.refresh()
    }

    renderUserMenu() {
        const userOptions = [
            { userName: "All users", userId: -1 },
            ...this.availableUsers,
        ]
        return (
            <React.Fragment>
                <label htmlFor="size">Show revisions from user:</label>
                <select
                    onChange={this.onCurrentlyActiveUserChange}
                    value={this.currentlyActiveUserId ?? -1}
                    style={{
                        // marginTop: "0.5rem",
                        // marginBottom: "0.5rem",
                        margin: "1rem 0 0 1rem",
                        padding: "0.5rem",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        fontSize: "1rem",
                        // backgroundColor: "white",
                        color: "#555",
                    }}
                >
                    {userOptions.map((user) => (
                        <option key={user.userId} value={user.userId}>
                            {user.userName}
                        </option>
                    ))}
                </select>
            </React.Fragment>
        )
    }

    renderGraphers() {
        // Render both charts next to each other
        console.log("renderGraphers")
        const gpt_model_name = this.getGPTModelNameUsed()
        return (
            <React.Fragment>
                <div className="charts-view">
                    {/* Original chart */}
                    <div
                        className="chart-view"
                        style={{
                            height: this.grapherBounds.height + 10,
                            width: this.grapherBounds.width,
                        }}
                    >
                        {this.currentSuggestedChartRevision && (
                            <React.Fragment>
                                <div
                                    className="header"
                                    style={{
                                        paddingBottom: "1rem",
                                        display: "flex",
                                        justifyContent: "flex-start",
                                    }}
                                >
                                    <Tippy content="This is what the chart looked like when the suggested revision was created.">
                                        <h3 className="grapherChart">
                                            Original
                                        </h3>
                                    </Tippy>
                                    <span
                                        className="text-muted"
                                        style={{ padding: "0.25rem" }}
                                    >
                                        {`(#${this.currentSuggestedChartRevision.chartId}, v${this.currentSuggestedChartRevision.originalConfig.version})`}
                                    </span>
                                    <Link
                                        className="btn btn-outline-secondary"
                                        to={`/charts/${this.currentSuggestedChartRevision.chartId}/edit`}
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
                            </React.Fragment>
                        )}
                        {this._isGraphersSet &&
                            this.currentSuggestedChartRevision &&
                            this.renderGrapher(
                                this.currentSuggestedChartRevision
                                    .originalConfig
                            )}
                    </div>
                    {this.showExistingChart && (
                        <div
                            className="chart-view"
                            style={{
                                height: this.grapherBounds.height + 10,
                                width: this.grapherBounds.width,
                            }}
                        >
                            {this.currentSuggestedChartRevision && (
                                <React.Fragment>
                                    <div
                                        className="header"
                                        style={{
                                            paddingBottom: "1rem",
                                            display: "flex",
                                            justifyContent: "flex-start",
                                        }}
                                    >
                                        <Tippy content="This is what the chart looks like right now on the OWID website.">
                                            <h3 className="grapherChart">
                                                Existing
                                            </h3>
                                        </Tippy>
                                        <span className="text-muted">
                                            {`(#${this.currentSuggestedChartRevision.chartId}, V${this.currentSuggestedChartRevision.existingConfig.version})`}
                                        </span>
                                        <Link
                                            className="btn btn-outline-secondary"
                                            to={`/charts/${this.currentSuggestedChartRevision.chartId}/edit`}
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
                                    {/* <p
                                        className="text-muted"
                                        style={{ fontWeight: 300 }}
                                    >
                                        This is what the chart looks like right now on the OWID website.
                                    </p> */}
                                </React.Fragment>
                            )}
                            {this._isGraphersSet &&
                                this.currentSuggestedChartRevision &&
                                this.renderGrapher(
                                    this.currentSuggestedChartRevision
                                        .existingConfig
                                )}
                        </div>
                    )}
                    {/* Suggested chart */}
                    <div
                        className="chart-view"
                        style={{
                            height: this.grapherBounds.height + 10,
                            width: this.grapherBounds.width,
                        }}
                    >
                        {this.currentSuggestedChartRevision && (
                            <React.Fragment>
                                <div
                                    className="header"
                                    style={{
                                        paddingBottom: "1rem",
                                        display: "flex",
                                        justifyContent: "space-between",
                                    }}
                                >
                                    {/* Title and link to edit */}
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "flex-start",
                                        }}
                                    >
                                        <Tippy content="This is what the chart will look like if the suggested revision is approved.">
                                            <h3 className="grapherChart">
                                                Suggested
                                            </h3>
                                        </Tippy>
                                        <span className="text-muted">
                                            {/* {`(#${this.currentSuggestedChartRevision.chartId}, V${this.currentSuggestedChartRevision.suggestedConfig.version})`} */}
                                        </span>
                                        <Link
                                            className="btn btn-outline-secondary"
                                            to={`/charts/${
                                                this
                                                    .currentSuggestedChartRevision
                                                    .chartId
                                            }/edit/${Base64.encode(
                                                JSON.stringify(
                                                    this
                                                        .currentSuggestedChartRevision
                                                        .suggestedConfig
                                                )
                                            )}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            title="Edit chart in a new tab"
                                        >
                                            Edit as chart{" "}
                                            {
                                                this
                                                    .currentSuggestedChartRevision
                                                    .chartId
                                            }{" "}
                                            <FontAwesomeIcon
                                                icon={faExternalLinkAlt}
                                            />
                                        </Link>
                                    </div>
                                    {/* GPT section */}
                                    <div
                                        style={{
                                            paddingRight: "1rem",
                                            display: "flex",
                                            justifyContent: "flex-start",
                                        }}
                                    >
                                        {/* <Tippy content="This is what the chart looked like when the suggested revision was created."> */}
                                        <button
                                            className="btn btn-info"
                                            onClick={
                                                this.updateChartConfigWithGPT
                                            }
                                            title="This is an experimental feature! It will replace the title and subtitle of the suggested chart with a new suggestion. You can go back to the original settings clicking on 'Reset'."
                                            disabled={
                                                gpt_model_name === undefined
                                            }
                                        >
                                            <FontAwesomeIcon
                                                icon={faMagicWandSparkles}
                                            />{" "}
                                            {
                                                gpt_model_name === undefined
                                                    ? "chatGPT unavailable"
                                                    : gpt_model_name //{this.usingGPT? ` #${this.gptNumDisp}` : ""}
                                            }
                                            {this.usingGPT
                                                ? ` #${this.gptNumDisp}`
                                                : ""}
                                        </button>
                                        {/* </Tippy> */}
                                        <button
                                            className="btn btn-link btn-sm"
                                            onClick={
                                                this.resetChartConfigWithGPT
                                            }
                                            title="Reset to original suggested configuration"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </div>
                            </React.Fragment>
                        )}
                        {this._isGraphersSet &&
                            this.currentSuggestedChartRevision &&
                            this.renderGrapher(
                                this.currentSuggestedChartRevision
                                    .suggestedConfig
                            )}
                    </div>
                </div>
            </React.Fragment>
        )
    }

    renderGrapher(grapherConfig: any) {
        console.log("renderGrapher")
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
                                dataApiUrlForAdmin:
                                    this.context.admin.settings
                                        .DATA_API_FOR_ADMIN_UI, // passed this way because clientSettings are baked and need a recompile to be updated
                            }}
                        />
                    </figure>
                )}
            </div>
        )
    }

    renderControls() {
        // Render controls on how to navigate the approval
        return (
            <div className="controls">
                {this.renderControlsNotes()}
                {this.renderControlsButtons()}
                {this.renderControlsNumberOfRevisions()}
            </div>
        )
    }

    renderControlsNotes() {
        // Render textarea in the controls block
        return (
            <TextAreaField
                label="Notes"
                placeholder="e.g. why are you rejecting this suggested revision?"
                value={this.decisionReasonInput}
                onValue={this.onDecisionReasonInput}
                disabled={!this._isGraphersSet}
                rows={1}
            />
        )
    }

    renderControlsButtons() {
        // Render buttons in controls section
        return (
            <div className="buttons">
                {this.listMode && (
                    <React.Fragment>
                        <button
                            className="btn btn-secondary"
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
                            className="btn btn-secondary"
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
                    className="btn btn-danger btn-lg"
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
                    {/* <SuggestedChartRevisionStatusIcon
                        status={SuggestedChartRevisionStatus.rejected}
                        setColor={false}
                    />{" "} */}
                    Reject
                </button>
                <button
                    className="btn btn-light btn-lg"
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
                    {/* <SuggestedChartRevisionStatusIcon
                        status={SuggestedChartRevisionStatus.flagged}
                        setColor={false}
                    />{" "} */}
                    Flag
                </button>
                <button
                    className="btn btn-success btn-lg"
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
                    {/* <SuggestedChartRevisionStatusIcon
                        status={SuggestedChartRevisionStatus.approved}
                        setColor={false}
                    />{" "} */}
                    Approve
                </button>
                {this.listMode && (
                    <React.Fragment>
                        <button
                            className="btn btn-secondary"
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
                            className="btn btn-secondary"
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
                            className="btn btn-secondary"
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
        )
    }

    renderControlsNumberOfRevisions() {
        // Render number of revisions block
        return (
            this.listMode && (
                <div className="row-input">
                    <span>Suggested revision</span>
                    <NumberField
                        value={this.rowNumValid}
                        onValue={this.onRowNumInput}
                    />
                    <span>
                        of {this.numAvailableRowsForSelectedUser}
                        {this.showPendingOnly ? " remaining" : ""} (
                        <Link to="/suggested-chart-revisions">View all</Link>)
                    </span>
                </div>
            )
        )
    }

    renderMeta() {
        // Renders metadata block
        return (
            <React.Fragment>
                <div>
                    <h2>Metadata</h2>
                    <ul className="meta">
                        <li>
                            <b>Suggested revision ID:</b>{" "}
                            {this.currentSuggestedChartRevision
                                ? this.currentSuggestedChartRevision.id
                                : ""}
                        </li>
                        <li>
                            <b>Chart ID:</b>{" "}
                            {this.currentSuggestedChartRevision
                                ? this.currentSuggestedChartRevision.chartId
                                : ""}
                        </li>
                        <li>
                            <b>Suggested revision created:</b>{" "}
                            {this.currentSuggestedChartRevision && (
                                <Timeago
                                    time={
                                        this.currentSuggestedChartRevision
                                            .createdAt
                                    }
                                    by={
                                        this.currentSuggestedChartRevision
                                            .createdByFullName
                                    }
                                />
                            )}
                        </li>

                        <li>
                            <b>Suggested revision last updated:</b>{" "}
                            {this.currentSuggestedChartRevision?.updatedAt && (
                                <Timeago
                                    time={
                                        this.currentSuggestedChartRevision
                                            .updatedAt
                                    }
                                    by={
                                        this.currentSuggestedChartRevision
                                            .updatedByFullName ??
                                        this.currentSuggestedChartRevision
                                            .createdByFullName
                                    }
                                />
                            )}
                        </li>
                        <li>
                            <b>Reason for suggested revision:</b>{" "}
                            {this.currentSuggestedChartRevision &&
                            this.currentSuggestedChartRevision.suggestedReason
                                ? this.currentSuggestedChartRevision
                                      .suggestedReason
                                : "None provided."}
                        </li>
                    </ul>
                </div>
                <div className="references">
                    <h2>References to original chart</h2>
                    <ReferencesSection references={this.chartReferences} />
                </div>
                <div className="changes_summary">
                    <h2>Indicator changes</h2>{" "}
                    {this.currentSuggestedChartRevision &&
                    this.currentSuggestedChartRevision.changesInDataSummary ? (
                        <div
                            dangerouslySetInnerHTML={{
                                __html: this.currentSuggestedChartRevision
                                    .changesInDataSummary,
                            }}
                        ></div>
                    ) : (
                        "No summary provided."
                    )}
                </div>
            </React.Fragment>
        )
    }

    renderReadme() {
        // Render the readme (instructions on how to use the approval tool)
        return (
            <div style={{ padding: "1rem" }}>
                <h4>Terminology</h4>
                <ul>
                    <li>
                        <b>Suggested (chart revision).</b> A suggested chart
                        revision is simply an amended OWID chart, but where the
                        amendments have not yet been applied to the chart in
                        question. A suggested chart revision is housed in the{" "}
                        <code>suggested_chart_revisions</code> table in{" "}
                        <code>MySQL</code>. If the suggested chart revision gets
                        approved, then the amendments are applied to the chart
                        (which overwrites and republishes the chart).
                    </li>
                    <li>
                        <b>Original (Original chart).</b> The chart as it
                        originally was when the suggested chart revision was
                        created.
                    </li>
                    <li>
                        <b>Existing (Existing chart).</b> The chart as it
                        currently exists on the OWID website.
                    </li>
                </ul>
                <h4>How to use</h4>
                <p>
                    You are shown one suggested chart revision at a time,
                    alongside the corresponding original chart as it was when
                    the suggested chart revision was created.
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
                                status={SuggestedChartRevisionStatus.approved}
                                setColor={false}
                            />{" "}
                            Approve
                        </button>
                        . This approves the suggestion, replacing the original
                        chart with the suggested chart (also republishes the
                        chart). Note: if a chart has been edited since the
                        suggested revision was created, you will not be allowed
                        to approve the suggested revision.
                    </li>
                    <li>
                        <b>Reject the suggested revision</b> by clicking{" "}
                        <button
                            className="btn btn-outline-danger btn"
                            style={{ pointerEvents: "none" }}
                            disabled={true}
                        >
                            <SuggestedChartRevisionStatusIcon
                                status={SuggestedChartRevisionStatus.rejected}
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
                                status={SuggestedChartRevisionStatus.flagged}
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
                            Edit <FontAwesomeIcon icon={faExternalLinkAlt} />
                        </Link>
                        . This opens the original chart in the chart editor. If
                        you save your changes to the original chart within the
                        chart editor, you will no longer have the option to
                        approve the suggested revision.
                    </li>
                    <li>
                        <b>
                            Edit the suggested chart revision as the original
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
                        editor. If you make and save changes to the chart within
                        the chart editor,{" "}
                        <i>
                            your config and data changes will be applied to the
                            original chart, equivalent to approving it.
                        </i>{" "}
                        Currently, the suggestion is not updated and the
                        approval is left as pending, but you will no longer be
                        able to approve it (since the chart has changed).
                        Because it has actually been applied, you can now reject
                        it.
                    </li>
                </ol>
                <h4>Other useful information</h4>
                <ul>
                    <li>
                        When you click the{" "}
                        <button
                            className="btn btn-outline-primary"
                            style={{ pointerEvents: "none" }}
                            disabled={true}
                        >
                            <SuggestedChartRevisionStatusIcon
                                status={SuggestedChartRevisionStatus.approved}
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
                                status={SuggestedChartRevisionStatus.rejected}
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
                                status={SuggestedChartRevisionStatus.flagged}
                                setColor={false}
                            />{" "}
                            Flag
                        </button>{" "}
                        button, anything you write in the "Notes" text field
                        will be saved. You can view these saved notes in the
                        "Decision reason" column{" "}
                        <Link to="/suggested-chart-revisions">here</Link>. If
                        you reject or flag a suggested chart revision, it is{" "}
                        <i>strongly recommended</i> that you describe your
                        reasoning in the "Notes" field.
                    </li>
                    <li>
                        If a suggested revision has been approved and the chart
                        has not changed since the revision was approved, then
                        you can undo the revision by clicking the{" "}
                        <button
                            className="btn btn-outline-danger btn"
                            style={{ pointerEvents: "none" }}
                            disabled={true}
                        >
                            <SuggestedChartRevisionStatusIcon
                                status={SuggestedChartRevisionStatus.rejected}
                                setColor={false}
                            />{" "}
                            Reject
                        </button>{" "}
                        button.
                    </li>
                    <li>
                        If a suggested revision has been rejected and the chart
                        has not changed since the revision was rejected, then
                        you can still approve the revision by clicking the{" "}
                        <button
                            className="btn btn-outline-primary btn"
                            style={{ pointerEvents: "none" }}
                            disabled={true}
                        >
                            <SuggestedChartRevisionStatusIcon
                                status={SuggestedChartRevisionStatus.approved}
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
                                status={SuggestedChartRevisionStatus.approved}
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
                                status={SuggestedChartRevisionStatus.rejected}
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
                                status={SuggestedChartRevisionStatus.flagged}
                                setColor={false}
                            />{" "}
                            Flag
                        </button>{" "}
                        buttons are disabled, this is because these actions are
                        not allowed for the suggested revision in question. For
                        example, if a chart has changed since the suggested
                        revision was created, you will not be allowed to approve
                        the revision.
                    </li>
                </ul>
            </div>
        )
    }

    renderSettings() {
        console.log("renderSettings")
        // Render settings
        return (
            <div style={{ padding: "1rem" }}>
                {/* {this.listMode && (
                    <div>
                        <Toggle
                            value={this.showPendingOnly}
                            onValue={this.onToggleShowPendingOnly}
                            label='Show "pending" revisions only'
                        />
                    </div>
                )} */}
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
                                        void this.rerenderGraphers()
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
                                        void this.rerenderGraphers()
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
                                { label: "Large", value: "large" },
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
                                        label: "Indicator ID",
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
                                    <FontAwesomeIcon icon={faSortAlphaDown} />
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
                                            this.sortOrder === SortOrder.desc
                                        }
                                    />{" "}
                                    <FontAwesomeIcon icon={faSortAlphaUpAlt} />
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
        )
    }
}
