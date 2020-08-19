import { Link } from "./Link"
import * as React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faChartBar } from "@fortawesome/free-solid-svg-icons/faChartBar"
import { faFile } from "@fortawesome/free-solid-svg-icons/faFile"
import { faUpload } from "@fortawesome/free-solid-svg-icons/faUpload"
import { faTable } from "@fortawesome/free-solid-svg-icons/faTable"
import { faDatabase } from "@fortawesome/free-solid-svg-icons/faDatabase"
import { faGlobe } from "@fortawesome/free-solid-svg-icons/faGlobe"
import { faTag } from "@fortawesome/free-solid-svg-icons/faTag"
import { faUser } from "@fortawesome/free-solid-svg-icons/faUser"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons/faArrowRight"
import { faEye } from "@fortawesome/free-solid-svg-icons/faEye"
import { faCoffee } from "@fortawesome/free-solid-svg-icons/faCoffee"
import { faNewspaper } from "@fortawesome/free-solid-svg-icons/faNewspaper"
import { faBook } from "@fortawesome/free-solid-svg-icons/faBook"

export const AdminSidebar = () => (
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
            <li>
                <a href="/admin/storybook" target="storybook">
                    <FontAwesomeIcon icon={faBook} /> Storybook
                </a>
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
