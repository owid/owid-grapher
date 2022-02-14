import { Link } from "./Link.js"
import * as React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faChartBar } from "@fortawesome/free-solid-svg-icons/faChartBar.js"
import { faFile } from "@fortawesome/free-solid-svg-icons/faFile.js"
import { faUpload } from "@fortawesome/free-solid-svg-icons/faUpload.js"
import { faTable } from "@fortawesome/free-solid-svg-icons/faTable.js"
import { faPen } from "@fortawesome/free-solid-svg-icons/faPen.js"
import { faDatabase } from "@fortawesome/free-solid-svg-icons/faDatabase.js"
import { faGlobe } from "@fortawesome/free-solid-svg-icons/faGlobe.js"
import { faTag } from "@fortawesome/free-solid-svg-icons/faTag.js"
import { faUser } from "@fortawesome/free-solid-svg-icons/faUser.js"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons/faArrowRight.js"
import { faEye } from "@fortawesome/free-solid-svg-icons/faEye.js"
import { faCoffee } from "@fortawesome/free-solid-svg-icons/faCoffee.js"
import { faNewspaper } from "@fortawesome/free-solid-svg-icons/faNewspaper.js"
import { faBook } from "@fortawesome/free-solid-svg-icons/faBook.js"
import { faSatelliteDish } from "@fortawesome/free-solid-svg-icons/faSatelliteDish.js"
import { faCodeBranch } from "@fortawesome/free-solid-svg-icons/faCodeBranch.js"
import { faDownload } from "@fortawesome/free-solid-svg-icons/faDownload.js"

export const AdminSidebar = (): JSX.Element => (
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
            </li>
            <li>
                <Link to="/explorers">
                    <FontAwesomeIcon icon={faCoffee} /> Explorers
                </Link>
            </li>
            <li className="header">DATA</li>
            <li>
                <Link to="/import">
                    <FontAwesomeIcon icon={faUpload} /> Import CSV
                </Link>
            </li>
            <li>
                <Link to="/datasets">
                    <FontAwesomeIcon icon={faTable} /> Datasets
                </Link>
            </li>
            <li>
                <Link to="/variables">
                    <FontAwesomeIcon icon={faDatabase} /> Variables
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
                <Link to="/suggested-chart-revisions">
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
                <Link to="/newsletter">
                    <FontAwesomeIcon icon={faNewspaper} /> Newsletter
                </Link>
            </li>
        </ul>
    </aside>
)
