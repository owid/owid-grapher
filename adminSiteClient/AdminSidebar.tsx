import { Link } from "./Link.js"
import React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faChartBar,
    faFile,
    faTable,
    faTruckFast,
    faSkullCrossbones,
    faPen,
    faDatabase,
    faGlobe,
    faTag,
    faUser,
    faArrowRight,
    faEye,
    faCoffee,
    faBook,
    faSatelliteDish,
    faCodeBranch,
    faDownload,
} from "@fortawesome/free-solid-svg-icons"

import { FASTTRACK_URL } from "../settings/clientSettings.js"

export const AdminSidebar = (): JSX.Element => (
    <aside className="AdminSidebar">
        <ul className="sidebar-menu">
            <li className="header">SITE</li>
            <li>
                <Link to="/posts-with-chart-counts">
                    <FontAwesomeIcon icon={faPen} /> Coding challenge: Posts
                    with chart counts
                </Link>
            </li>
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
            </li>
            <li className="header">DATA</li>

            <li>
                <a
                    href={FASTTRACK_URL}
                    target="_blank"
                    rel="noopener"
                    title="Tailscale required"
                >
                    <FontAwesomeIcon icon={faTruckFast} /> Fast-track
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
                <Link to="/standardize">
                    <FontAwesomeIcon icon={faGlobe} /> Country tool
                </Link>
            </li>
            <li>
                <Link to="/tags">
                    <FontAwesomeIcon icon={faTag} /> Tags
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
                    <FontAwesomeIcon icon={faArrowRight} /> Redirects
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
