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
    faHatWizard,
    faSitemap,
    faPanorama,
    faImage,
    faLightbulb,
    faStar,
    faCircleInfo,
    faFolder,
    faMonument,
    faDisplay,
    faLinkSlash,
    faCodeCompare,
} from "@fortawesome/free-solid-svg-icons"

import { ETL_WIZARD_URL } from "../settings/clientSettings.js"

export const AdminSidebar = (): React.ReactElement => (
    <aside className="AdminSidebar">
        <ul className="sidebar-menu">
            <li className="header">SITE</li>
            <li>
                <Link to="/charts">
                    <FontAwesomeIcon icon={faChartBar} className="fa-fw" />{" "}
                    Charts
                </Link>
            </li>
            <li>
                <Link to="/narrative-charts">
                    <FontAwesomeIcon icon={faPanorama} className="fa-fw" />{" "}
                    Narrative charts
                </Link>
            </li>
            <li>
                <Link to="/multi-dims">
                    <FontAwesomeIcon icon={faChartLine} className="fa-fw" />{" "}
                    Multi-dims
                </Link>
            </li>
            <li>
                <Link to="/featured-metrics">
                    <FontAwesomeIcon icon={faStar} className="fa-fw" />{" "}
                    <span style={{ fontSize: 12 }}>Featured Metrics</span>
                </Link>
            </li>
            <li>
                <Link to="/data-insights">
                    <FontAwesomeIcon icon={faLightbulb} className="fa-fw" />{" "}
                    Data insights
                </Link>
            </li>
            <li>
                <Link to="/gdocs">
                    <FontAwesomeIcon icon={faFile} className="fa-fw" /> Google
                    Docs
                </Link>
            </li>
            <li>
                <Link to="/orphaned-articles">
                    <FontAwesomeIcon icon={faLinkSlash} className="fa-fw" />{" "}
                    Orphaned articles
                </Link>
            </li>
            <li>
                <Link to="/dods">
                    <FontAwesomeIcon icon={faCircleInfo} className="fa-fw" />{" "}
                    DoDs
                </Link>
            </li>
            <li>
                <Link to="/images">
                    <FontAwesomeIcon icon={faImage} className="fa-fw" /> Images
                </Link>
            </li>
            <li>
                <Link to="/static-viz">
                    <FontAwesomeIcon icon={faMonument} className="fa-fw" />{" "}
                    Static Viz
                </Link>
            </li>
            <li>
                <Link to="/slideshows">
                    <FontAwesomeIcon icon={faDisplay} className="fa-fw" />{" "}
                    Slideshows
                </Link>
            </li>
            <li>
                <Link to="/explorers">
                    <FontAwesomeIcon icon={faCoffee} className="fa-fw" />{" "}
                    Explorers
                </Link>
                <ul>
                    <li>
                        <Link to="/explorer-tags">
                            <FontAwesomeIcon icon={faTag} className="fa-fw" />{" "}
                            Explorer Tags
                        </Link>
                    </li>
                </ul>
            </li>
            <li>
                <Link to="/files">
                    <FontAwesomeIcon icon={faFolder} className="fa-fw" /> Files
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
                    <FontAwesomeIcon icon={faHatWizard} className="fa-fw" />{" "}
                    Wizard
                </a>
            </li>
            <li>
                <Link to="/datasets">
                    <FontAwesomeIcon icon={faTable} className="fa-fw" />{" "}
                    Datasets
                </Link>
            </li>
            <li>
                <Link to="/variables">
                    <FontAwesomeIcon icon={faDatabase} className="fa-fw" />{" "}
                    Indicators
                </Link>
            </li>
            <li>
                <Link to="/bulk-grapher-config-editor">
                    <FontAwesomeIcon
                        icon={faSkullCrossbones}
                        className="fa-fw"
                    />{" "}
                    Bulk chart editor
                </Link>
            </li>
            <li>
                <Link to="/variable-annotations">
                    <FontAwesomeIcon icon={faPen} className="fa-fw" /> Data
                    annotation
                </Link>
            </li>
            <li>
                <Link to="/tags">
                    <FontAwesomeIcon icon={faTag} className="fa-fw" /> Tags
                </Link>
            </li>
            <li>
                <Link to="/tag-graph">
                    <FontAwesomeIcon icon={faSitemap} className="fa-fw" /> Tag
                    Graph
                </Link>
            </li>
            <li className="header">SETTINGS</li>
            <li>
                <Link to="/users/">
                    <FontAwesomeIcon icon={faUser} className="fa-fw" /> Users
                </Link>
            </li>
            <li>
                <Link to="/redirects">
                    <FontAwesomeIcon icon={faArrowRight} className="fa-fw" />{" "}
                    Chart Redirects
                </Link>
            </li>
            <li>
                <Link to="/multi-dim-redirects">
                    <FontAwesomeIcon icon={faArrowRight} className="fa-fw" />{" "}
                    <span style={{ fontSize: 12 }}>Multi-dim redirects</span>
                </Link>
            </li>
            <li>
                <Link to="/site-redirects">
                    <FontAwesomeIcon icon={faArrowRight} className="fa-fw" />{" "}
                    Site Redirects
                </Link>
            </li>
            <li className="header">UTILITIES</li>
            <li>
                <Link to="/deploys">
                    <FontAwesomeIcon icon={faSatelliteDish} className="fa-fw" />{" "}
                    Deploy status
                </Link>
            </li>
            <li>
                <Link to="/svgtester">
                    <FontAwesomeIcon icon={faCodeCompare} className="fa-fw" />{" "}
                    SVG tester
                </Link>
            </li>
            <li>
                <Link to="/test">
                    <FontAwesomeIcon icon={faEye} className="fa-fw" /> Chart
                    previews
                </Link>
            </li>
            <li>
                <Link to="/callout-functions">
                    <FontAwesomeIcon icon={faCircleInfo} className="fa-fw" />{" "}
                    Callout functions
                </Link>
            </li>
        </ul>
    </aside>
)
