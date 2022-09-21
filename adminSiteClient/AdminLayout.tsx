import React from "react"
import { observable, action, computed, makeObservable } from "mobx"
import { observer } from "mobx-react"

import { Link } from "./Link.js"
import { EditorFAQ } from "./EditorFAQ.js"
import { AdminSidebar } from "./AdminSidebar.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    DefaultNewExplorerSlug,
    EXPLORERS_ROUTE_FOLDER,
} from "../explorer/ExplorerConstants.js"

export const AdminLayout = observer(
    class AdminLayout extends React.Component<{
        noSidebar?: boolean
        title?: string
        children: React.ReactNode
    }> {
        static contextType = AdminAppContext
        context!: AdminAppContextType

        private showFAQ: boolean = false
        private showSidebar: boolean = false

        constructor(props: {
            noSidebar?: boolean
            title?: string
            children: React.ReactNode
        }) {
            super(props)

            makeObservable<
                AdminLayout,
                "showFAQ" | "showSidebar" | "setInitialSidebarState"
            >(this, {
                showFAQ: observable,
                showSidebar: observable,
                onToggleFAQ: action.bound,
                onToggleSidebar: action.bound,
                setInitialSidebarState: action.bound,
                environmentSpan: computed,
            })
        }

        onToggleFAQ(): void {
            this.showFAQ = !this.showFAQ
        }

        onToggleSidebar(): void {
            this.showSidebar = !this.showSidebar
        }

        private setInitialSidebarState(value: boolean): void {
            this.showSidebar = value
        }

        componentDidMount(): void {
            this.setInitialSidebarState(!this.props.noSidebar)
            this.componentDidUpdate()
        }

        componentDidUpdate(): void {
            if (this.props.title)
                document.title = this.props.title + " - owid-admin"
        }

        get environmentSpan(): JSX.Element {
            const { admin } = this.context
            if (admin.settings.ENV === "development") {
                return <span className="dev">dev</span>
            } else if (window.location.origin === "https://owid.cloud") {
                return <span className="live">live</span>
            } else {
                return <span className="test">test</span>
            }
        }

        render(): JSX.Element {
            const { admin } = this.context
            const { showFAQ: isFAQ, showSidebar, environmentSpan } = this

            return (
                <div
                    className={
                        "AdminLayout" + (showSidebar ? " withSidebar" : "")
                    }
                >
                    {isFAQ && <EditorFAQ onClose={this.onToggleFAQ} />}
                    <nav className="navbar navbar-dark bg-dark flex-row navbar-expand-lg">
                        <button
                            className="navbar-toggler"
                            type="button"
                            onClick={this.onToggleSidebar}
                        >
                            <span className="navbar-toggler-icon"></span>
                        </button>
                        <Link className="navbar-brand" to="/">
                            owid-admin {environmentSpan}
                        </Link>
                        <ul className="navbar-nav">
                            <li className="nav-item">
                                <Link className="nav-link" to="/charts/create">
                                    <FontAwesomeIcon icon={faPlus} /> New chart
                                </Link>
                            </li>
                            <li className="nav-item">
                                <a
                                    className="nav-link"
                                    href={`/admin/${EXPLORERS_ROUTE_FOLDER}/${DefaultNewExplorerSlug}`}
                                >
                                    <FontAwesomeIcon icon={faPlus} /> New
                                    Explorer
                                </a>
                            </li>
                            <li className="nav-item">
                                <a
                                    className="nav-link"
                                    onClick={this.onToggleFAQ}
                                >
                                    FAQ
                                </a>
                            </li>
                            <li className="nav-item">
                                <a
                                    className="nav-link"
                                    href="/wp/wp-admin"
                                    target="_blank"
                                >
                                    Wordpress
                                </a>
                            </li>
                        </ul>
                        <ul className="navbar-nav ml-auto">
                            <li className="nav-item">
                                <a
                                    className="nav-link logout"
                                    href="/admin/logout"
                                >
                                    {admin.username}
                                </a>
                            </li>
                        </ul>
                    </nav>
                    {showSidebar && <AdminSidebar />}
                    {this.props.children}
                </div>
            )
        }
    }
)
