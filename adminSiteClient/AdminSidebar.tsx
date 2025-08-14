import { Link } from "./Link.js"
import * as React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faChartBar,
    faChartLine,
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
    faSatelliteDish,
    faDownload,
    faHatWizard,
    faSitemap,
    faPanorama,
    faImage,
    faLightbulb,
    faStar,
    faCircleInfo,
    faFolder,
} from "@fortawesome/free-solid-svg-icons"

import { ETL_WIZARD_URL } from "../settings/clientSettings.js"

export const AdminSidebar = (): React.ReactElement => (
    <aside className="AdminSidebar">
        <ul className="sidebar-menu">
            <li className="header">SITE</li>
            <li>
                <Link to="/charts">
                    <FontAwesomeIcon icon={faChartBar} fixedWidth /> Charts
                </Link>
            </li>
            <li>
                <Link to="/narrative-charts">
                    <FontAwesomeIcon icon={faPanorama} fixedWidth /> Narrative
                    charts
                </Link>
            </li>
            <li>
                <Link to="/multi-dims">
                    <FontAwesomeIcon icon={faChartLine} fixedWidth /> Multi-dims
                </Link>
            </li>
            <li>
                <Link to="/featured-metrics">
                    <FontAwesomeIcon icon={faStar} fixedWidth />{" "}
                    <span style={{ fontSize: 12 }}>Featured Metrics</span>
                </Link>
            </li>
            <li>
                <Link to="/data-insights">
                    <FontAwesomeIcon icon={faLightbulb} fixedWidth /> Data
                    insights
                </Link>
            </li>
            <li>
                <Link to="/gdocs">
                    <FontAwesomeIcon icon={faFile} fixedWidth /> Google Docs
                </Link>
            </li>
            <li>
                <Link to="/dods">
                    <FontAwesomeIcon icon={faCircleInfo} fixedWidth /> DoDs
                </Link>
            </li>
            <li>
                <Link to="/images">
                    <FontAwesomeIcon icon={faImage} fixedWidth /> Images
                </Link>
            </li>
            <li>
                <Link to="/explorers">
                    <FontAwesomeIcon icon={faCoffee} fixedWidth /> Explorers
                </Link>
                <ul>
                    <li>
                        <Link to="/explorer-tags">
                            <FontAwesomeIcon icon={faTag} fixedWidth /> Explorer
                            Tags
                        </Link>
                    </li>
                </ul>
            </li>
            <li>
                <Link to="/files">
                    <FontAwesomeIcon icon={faFolder} fixedWidth /> Files
                </Link>
            </li>
            <li className="header">DATA</li>

            <li>
                <a
                    href={ETL_WIZARD_URL}
                    target="_blank"
                    rel="noopener"
                    title="Tailscale required"
                >
                    <FontAwesomeIcon icon={faHatWizard} fixedWidth /> Wizard
                </a>
            </li>
            <li>
                <Link to="/datasets">
                    <FontAwesomeIcon icon={faTable} fixedWidth /> Datasets
                </Link>
            </li>
            <li>
                <Link to="/variables">
                    <FontAwesomeIcon icon={faDatabase} fixedWidth /> Indicators
                </Link>
            </li>
            <li>
                <Link to="/bulk-grapher-config-editor">
                    <FontAwesomeIcon icon={faSkullCrossbones} fixedWidth /> Bulk
                    chart editor
                </Link>
            </li>
            <li>
                <Link to="/variable-annotations">
                    <FontAwesomeIcon icon={faPen} fixedWidth /> Data annotation
                </Link>
            </li>
            <li>
                <Link to="/tags">
                    <FontAwesomeIcon icon={faTag} fixedWidth /> Tags
                </Link>
            </li>
            <li>
                <Link to="/tag-graph">
                    <FontAwesomeIcon icon={faSitemap} fixedWidth /> Tag Graph
                </Link>
            </li>
            <li>
                <Link to="/bulk-downloads">
                    <FontAwesomeIcon icon={faDownload} fixedWidth /> Bulk
                    downloads
                </Link>
            </li>
            <li className="header">SETTINGS</li>
            <li>
                <Link to="/users/">
                    <FontAwesomeIcon icon={faUser} fixedWidth /> Users
                </Link>
            </li>
            <li>
                <Link to="/redirects">
                    <FontAwesomeIcon icon={faArrowRight} fixedWidth /> Chart
                    Redirects
                </Link>
            </li>
            <li>
                <Link to="/site-redirects">
                    <FontAwesomeIcon icon={faArrowRight} fixedWidth /> Site
                    Redirects
                </Link>
            </li>
            <li>
                <Link to="/test">
                    <FontAwesomeIcon icon={faEye} fixedWidth /> Test
                </Link>
            </li>
            <li className="header">UTILITIES</li>
            <li>
                <Link to="/deploys">
                    <FontAwesomeIcon icon={faSatelliteDish} fixedWidth /> Deploy
                    status
                </Link>
            </li>
        </ul>
    </aside>
)
