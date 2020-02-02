import { faArrowRight } from "@fortawesome/free-solid-svg-icons/faArrowRight"
import { faChartBar } from "@fortawesome/free-solid-svg-icons/faChartBar"
import { faDatabase } from "@fortawesome/free-solid-svg-icons/faDatabase"
import { faEye } from "@fortawesome/free-solid-svg-icons/faEye"
import { faFile } from "@fortawesome/free-solid-svg-icons/faFile"
import { faGlobe } from "@fortawesome/free-solid-svg-icons/faGlobe"
import { faNewspaper } from "@fortawesome/free-solid-svg-icons/faNewspaper"
import { faTable } from "@fortawesome/free-solid-svg-icons/faTable"
import { faTag } from "@fortawesome/free-solid-svg-icons/faTag"
import { faUpload } from "@fortawesome/free-solid-svg-icons/faUpload"
import { faUser } from "@fortawesome/free-solid-svg-icons/faUser"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import * as React from "react"
import { Link } from "./Link"

export function AdminSidebar(props: { onDismiss: () => void }) {
    return (
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
                    <Link to="/standardize">
                        <FontAwesomeIcon icon={faGlobe} /> Country tool
                    </Link>
                </li>
                <li>
                    <Link to="/tags">
                        <FontAwesomeIcon icon={faTag} /> Tags
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
                <li className="header">UTILITIES</li>
                <li>
                    <Link to="/newsletter">
                        <FontAwesomeIcon icon={faNewspaper} /> Newsletter
                    </Link>
                </li>
            </ul>
        </aside>
    )
}
