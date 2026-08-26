import * as React from "react"
import { observable, action, computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ConfigProvider, Layout, ThemeConfig } from "antd"

import { Link } from "./Link.js"
import { EditorFAQ } from "./EditorFAQ.js"
import { AdminSidebar } from "./AdminSidebar.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { faBars, faPlus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    DefaultNewExplorerSlug,
    EXPLORERS_ROUTE_FOLDER,
} from "@ourworldindata/explorer"

/**
 * The charcoal the admin header has always used (the old navbar's Bootstrap
 * `bg-dark`; the `#001c3d` navy that used to sit behind it was never visible).
 */
const HEADER_BG = "#343a40"
/** The dark slate the sidebar has always used — distinct from the header. */
const SIDEBAR_BG = "#222d32"
const HEADER_HEIGHT = 48

/**
 * Only touches antd's `Layout` and `Menu` tokens, and of those only the ones
 * that style the chrome: `Layout` isn't used anywhere else in the admin, and
 * the `dark*` menu tokens don't reach the light menus that dropdowns render.
 */
const chromeTheme: ThemeConfig = {
    components: {
        Layout: {
            headerBg: HEADER_BG,
            headerHeight: HEADER_HEIGHT,
            headerPadding: "0 16px",
            siderBg: SIDEBAR_BG,
            // The pages below expect to sit on white, not on antd's grey
            // `colorBgLayout`.
            bodyBg: "#fff",
        },
        // The sidebar's pre-antd palette: muted slate text on `#222d32`,
        // darker slate for the active entry, white on hover.
        Menu: {
            darkItemBg: SIDEBAR_BG,
            darkSubMenuItemBg: SIDEBAR_BG,
            darkItemColor: "#b8c7ce",
            darkItemSelectedBg: "#1a2226",
            darkItemHoverBg: "#1e282c",
            darkItemHoverColor: "#fff",
            darkGroupTitleColor: "#4b646f",
        },
    },
}

interface AdminLayoutProps {
    noSidebar?: boolean
    title?: string
    children: React.ReactNode
}

@observer
export class AdminLayout extends React.Component<AdminLayoutProps> {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    private showFAQ: boolean = false
    private showSidebar: boolean

    constructor(props: AdminLayoutProps) {
        super(props)

        this.showSidebar = !props.noSidebar

        makeObservable<AdminLayout, "showFAQ" | "showSidebar">(this, {
            showFAQ: observable,
            showSidebar: observable,
        })
    }

    @action.bound onToggleFAQ(): void {
        this.showFAQ = !this.showFAQ
    }

    @action.bound onToggleSidebar(): void {
        this.showSidebar = !this.showSidebar
    }

    override componentDidMount(): void {
        this.componentDidUpdate()
    }

    override componentDidUpdate(): void {
        if (this.props.title)
            document.title = this.props.title + " - owid-admin"
    }

    @computed get environmentSpan(): React.ReactElement {
        const { admin } = this.context
        if (admin.settings.ENV === "development") {
            return (
                <span className="AdminLayout__env AdminLayout__env--dev">
                    dev
                </span>
            )
        } else if (
            ["https://owid.cloud", "https://admin.owid.io"].includes(
                window.location.origin
            )
        ) {
            return (
                <span className="AdminLayout__env AdminLayout__env--live">
                    live
                </span>
            )
        } else {
            return (
                <span className="AdminLayout__env AdminLayout__env--test">
                    test
                </span>
            )
        }
    }

    override render(): React.ReactElement {
        const { admin } = this.context
        const { showFAQ, showSidebar, environmentSpan } = this

        return (
            <ConfigProvider theme={chromeTheme}>
                <Layout className="AdminLayout">
                    {showFAQ && <EditorFAQ onClose={this.onToggleFAQ} />}
                    <Layout.Header className="AdminLayout__header">
                        <button
                            className="AdminLayout__sidebar-toggle"
                            type="button"
                            aria-label="Toggle sidebar"
                            aria-expanded={showSidebar}
                            onClick={this.onToggleSidebar}
                        >
                            <FontAwesomeIcon icon={faBars} />
                        </button>
                        <Link className="AdminLayout__brand" to="/">
                            owid-admin {environmentSpan}
                        </Link>
                        <nav className="AdminLayout__nav">
                            <Link
                                className="AdminLayout__nav-link"
                                to="/charts/create"
                            >
                                <FontAwesomeIcon icon={faPlus} /> New chart
                            </Link>
                            <a
                                className="AdminLayout__nav-link"
                                href={`/admin/${EXPLORERS_ROUTE_FOLDER}/${DefaultNewExplorerSlug}`}
                            >
                                <FontAwesomeIcon icon={faPlus} /> New Explorer
                            </a>
                            <button
                                className="AdminLayout__nav-link"
                                type="button"
                                onClick={this.onToggleFAQ}
                            >
                                FAQ
                            </button>
                        </nav>
                        <a className="AdminLayout__user" href="/admin/logout">
                            {admin.username}
                        </a>
                    </Layout.Header>
                    <Layout className="AdminLayout__body" hasSider>
                        <AdminSidebar collapsed={!showSidebar} />
                        {/* A plain div rather than antd's `Layout.Content`,
                        which renders a `<main>`: every page below already
                        brings its own, and the admin styles `main` globally.
                        `AdminLayout.scss` gives it the sizing that
                        `.ant-layout-content` would have. */}
                        <div className="AdminLayout__content">
                            {this.props.children}
                        </div>
                    </Layout>
                </Layout>
            </ConfigProvider>
        )
    }
}
