import { observer } from "mobx-react"
import { ObservedReactComponent } from "@ourworldindata/components"
import { action, observable, runInAction } from "mobx"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faCheckCircle } from "@fortawesome/free-solid-svg-icons"

import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { Deploy, DeployStatus } from "@ourworldindata/utils"
import { Timeago } from "./Forms.js"

const statusLabel: Record<DeployStatus, string> = {
    [DeployStatus.queued]: "Next up",
    [DeployStatus.pending]: "Deploying",
}

@observer
export class DeployStatusPage extends ObservedReactComponent {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable deploys: Deploy[] = []
    @observable canManuallyDeploy = true
    refreshIntervalId?: number

    componentDidMount() {
        void this.getData()
        document.addEventListener(
            "visibilitychange",
            this.handleVisibilityChange
        )
    }

    componentWillUnmount() {
        document.removeEventListener(
            "visibilitychange",
            this.handleVisibilityChange
        )
    }

    render() {
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
                            Manually enqueue a deploy
                        </button>
                    </div>
                    {this.deploys.length > 0 ? (
                        <table className="DeploysTable">
                            <thead>
                                <tr>
                                    <th>Status</th>
                                    <th>Note</th>
                                    <th>Author</th>
                                    <th>Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {this.deploys.map((deploy) =>
                                    deploy.changes.map((change, i) => (
                                        <tr key={`${deploy.status}-${i}`}>
                                            <td
                                                className={`cell-status cell-status--${deploy.status}`}
                                            >
                                                {statusLabel[deploy.status]}
                                            </td>
                                            <td className="cell-message">
                                                {change.message}
                                            </td>
                                            <td className="cell-author">
                                                {change.authorName}
                                            </td>
                                            <td className="cell-time">
                                                <Timeago
                                                    time={change.timeISOString}
                                                />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <div className="all-published-notice">
                            <p>
                                <span className="icon">
                                    <FontAwesomeIcon icon={faCheckCircle} />
                                </span>{" "}
                                All changes are successfully deployed.
                            </p>
                        </div>
                    )}
                    <p>
                        Past deploys can be found in the{" "}
                        <a
                            href="https://github.com/owid/owid-static/commits/master"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <strong>owid-static</strong> GitHub repository
                        </a>
                        .
                    </p>
                </main>
            </AdminLayout>
        )
    }

    @action.bound handleVisibilityChange = () => {
        if (document.visibilityState === "visible") void this.getData()
    }

    @action.bound async triggerDeploy() {
        const { admin } = this.context
        await admin.rawRequest("/api/deploy", undefined, "PUT")
    }

    async getData() {
        const { admin } = this.context
        if (admin.currentRequests.length > 0) return

        const json = (await admin.getJSON("/api/deploys.json")) as {
            deploys: Deploy[]
        }
        runInAction(() => {
            this.deploys = json.deploys
        })
    }
}
