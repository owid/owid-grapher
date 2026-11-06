import { Component } from "react"
import { observer } from "mobx-react"
import { action, observable, runInAction, makeObservable } from "mobx"

import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { DeployBuild } from "@ourworldindata/utils"
import { Timeago } from "./Forms.js"

type DeployStateKind = "waiting" | "deploying" | "deployed" | "failed" | "other"

// Buildkite's build states, grouped the way an editor cares about them
const stateKinds: Record<string, DeployStateKind> = {
    creating: "waiting",
    scheduled: "waiting",
    running: "deploying",
    failing: "deploying",
    passed: "deployed",
    failed: "failed",
}

const stateLabels: Record<DeployStateKind, string> = {
    waiting: "Waiting",
    deploying: "Deploying",
    deployed: "Deployed",
    failed: "Failed",
    other: "Didn't run",
}

@observer
export class DeployStatusPage extends Component {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    builds: DeployBuild[] = []
    canManuallyDeploy = true

    constructor(props: Record<string, never>) {
        super(props)

        makeObservable(this, {
            builds: observable,
            canManuallyDeploy: observable,
            handleVisibilityChange: action.bound,
        })
    }

    override componentDidMount() {
        void this.getData()
        document.addEventListener(
            "visibilitychange",
            this.handleVisibilityChange
        )
    }

    override componentWillUnmount() {
        document.removeEventListener(
            "visibilitychange",
            this.handleVisibilityChange
        )
    }

    override render() {
        return (
            <AdminLayout title="Deploys">
                <main className="DeploysPage">
                    <div className="topbar">
                        <h2>Deploy status</h2>
                        <button
                            className="btn btn-secondary"
                            type="button"
                            disabled={!this.canManuallyDeploy}
                            onClick={async () => {
                                this.canManuallyDeploy = false
                                await this.triggerDeploy()
                                await this.getData()
                            }}
                        >
                            Deploy now
                        </button>
                    </div>
                    <p>
                        Every published change starts a deploy that rebakes the
                        whole site, which takes about 10 minutes. When several
                        changes come in at once, a later deploy can take an
                        earlier one's changes live.
                    </p>
                    {this.builds.length > 0 ? (
                        <table className="DeploysTable">
                            <thead>
                                <tr>
                                    <th>Status</th>
                                    <th>Changes</th>
                                    <th>Requested</th>
                                </tr>
                            </thead>
                            <tbody>
                                {this.builds.map((build) => {
                                    const kind =
                                        stateKinds[build.state] ?? "other"
                                    return (
                                        <tr key={build.number}>
                                            <td
                                                className={`cell-status cell-status--${kind}`}
                                            >
                                                <a
                                                    href={build.webUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    {stateLabels[kind]}
                                                </a>
                                            </td>
                                            <td className="cell-message">
                                                {build.message}
                                            </td>
                                            <td className="cell-time">
                                                <Timeago
                                                    time={build.createdAt}
                                                />
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <p>No deploys yet.</p>
                    )}
                </main>
            </AdminLayout>
        )
    }

    handleVisibilityChange = () => {
        if (document.visibilityState === "visible") void this.getData()
    }

    @action.bound async triggerDeploy() {
        const { admin } = this.context
        // A failed request shows requestJSON's error modal
        const json = await admin.requestJSON<{
            success: boolean
            message?: string
        }>("/api/deploy", {}, "PUT")
        if (!json.success)
            admin.setErrorMessage({
                title: "No deploy requested",
                content: json.message ?? "Unknown error",
            })
    }

    async getData() {
        const { admin } = this.context
        if (admin.currentRequests.length > 0) return

        const json = await admin.getJSON<{ builds: DeployBuild[] }>(
            "/api/deploys.json"
        )
        runInAction(() => {
            this.builds = json.builds
        })
    }
}
