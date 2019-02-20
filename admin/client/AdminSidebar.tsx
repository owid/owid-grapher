import { Link } from './Link'
import * as React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChartBar, faFile, faUpload, faTable, faDatabase, faGlobe, faTag, faUser, faArrowRight, faEye } from '@fortawesome/free-solid-svg-icons'

export function AdminSidebar(props: { onDismiss: () => void }) {
    return <aside className="AdminSidebar">
        <ul className="sidebar-menu">
            <li className="header">SITE</li>
            <li><Link to="/charts"><FontAwesomeIcon icon={faChartBar}/> Charts</Link></li>
            <li><Link to="/posts"><FontAwesomeIcon icon={faFile}/> Posts</Link></li>
            <li className="header">DATA</li>
            <li><Link to="/import"><FontAwesomeIcon icon={faUpload}/> Import CSV</Link></li>
            <li><Link to="/datasets"><FontAwesomeIcon icon={faTable}/> Datasets</Link></li>
            <li><Link to="/variables"><FontAwesomeIcon icon={faDatabase}/> Variables</Link></li>
            <li><Link to="/standardize"><FontAwesomeIcon icon={faGlobe}/> Country tool</Link></li>
            <li><Link to="/tags"><FontAwesomeIcon icon={faTag}/> Tags</Link></li>
            <li className="header">SETTINGS</li>
            <li><Link to="/users/"><FontAwesomeIcon icon={faUser}/> Users</Link></li>
            <li><Link to="/redirects"><FontAwesomeIcon icon={faArrowRight}/> Redirects</Link></li>
            <li><Link to="/test"><FontAwesomeIcon icon={faEye}/> Test</Link></li>
        </ul>
    </aside>
}