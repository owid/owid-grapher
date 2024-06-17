import { Link } from "./Link.js"
import React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faChartBar,
    faFile,
    faTable,
    faSkullCrossbones,
    faPen,
    faDatabase,
    faTag,
    faUser,
    faArrowRight,
    faEye,
    faCoffee,
    faBook,
    faSatelliteDish,
    faCodeBranch,
    faDownload,
    faHatWizard,
    faSitemap,
} from "@fortawesome/free-solid-svg-icons"

import { ETL_WIZARD_URL } from "../settings/clientSettings.js"

export const AdminSidebar = (): React.ReactElement => (
    <aside className="AdminSidebar">
        <ul className="sidebar-menu">
            <li className="header">SITE</li>
            <li>
                <Link to="/charts">
                    <FontAwesomeIcon icon={faChartBar} /> Charts
                </Link>
            </li>
            <li>
                <Link to="/posts">
                    <FontAwesomeIcon icon={faFile} /> Posts
                </Link>
                <Link to="/gdocs">
                    <FontAwesomeIcon icon={faFile} /> Google Docs
                </Link>
            </li>
            <li>
                <Link to="/explorers">
                    <FontAwesomeIcon icon={faCoffee} /> Explorers
                </Link>
                <ul>
                    <li>
                        <Link to="/explorer-tags">
                            <FontAwesomeIcon icon={faTag} /> Explorer Tags
                        </Link>
                    </li>
                </ul>
            </li>
            <li className="header">DATA</li>

            <li>
                <a
                    href={ETL_WIZARD_URL}
                    target="_blank"
                    rel="noopener"
                    title="Tailscale required"
                >
                    <FontAwesomeIcon icon={faHatWizard} /> Wizard
                </a>
            </li>
            <li>
                <Link to="/datasets">
                    <FontAwesomeIcon icon={faTable} /> Datasets
                </Link>
            </li>
            <li>
                <Link to="/variables">
                    <FontAwesomeIcon icon={faDatabase} /> Indicators
                </Link>
            </li>
            <li>
                <Link to="/bulk-grapher-config-editor">
                    <FontAwesomeIcon icon={faSkullCrossbones} /> Bulk chart
                    editor
                </Link>
            </li>
            <li>
                <Link to="/variable-annotations">
                    <FontAwesomeIcon icon={faPen} /> Data annotation
                </Link>
            </li>
            <li>
                <Link to="/tags">
                    <FontAwesomeIcon icon={faTag} /> Tags
                </Link>
            </li>
            <li>
                <Link to="/tag-graph">
                    <FontAwesomeIcon icon={faSitemap} /> Tag Graph
                </Link>
            </li>
            <li>
                <Link to="/bulk-downloads">
                    <FontAwesomeIcon icon={faDownload} /> Bulk downloads
                </Link>
            </li>
            <li>
                <Link to="/suggested-chart-revisions/review">
                    <FontAwesomeIcon icon={faCodeBranch} /> Suggested chart
                    revisions
                </Link>
            </li>
            <li className="header">SETTINGS</li>
            <li>
                <Link to="/users/">
                    <FontAwesomeIcon icon={faUser} /> Users
                </Link>
            </li>
            <li>
                <Link to="/redirects">
                    <FontAwesomeIcon icon={faArrowRight} /> Chart Redirects
                </Link>
            </li>
            <li>
                <Link to="/site-redirects">
                    <FontAwesomeIcon icon={faArrowRight} /> Site Redirects
                </Link>
            </li>
            <li>
                <Link to="/test">
                    <FontAwesomeIcon icon={faEye} /> Test
                </Link>
            </li>
            <li>
                <a
                    href="https://owid.github.io/stories/"
                    target="_blank"
                    rel="noopener"
                >
                    <FontAwesomeIcon icon={faBook} /> Storybook
                </a>
            </li>
            <li className="header">UTILITIES</li>
            <li>
                <Link to="/deploys">
                    <FontAwesomeIcon icon={faSatelliteDish} /> Deploy status
                </Link>
            </li>
        </ul>
    </aside>
)
