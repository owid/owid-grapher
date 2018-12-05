import Link from './Link'
import * as React from 'react'

export default function AdminSidebar(props: { onDismiss: () => void }) {
    return <aside className="AdminSidebar">
        <ul className="sidebar-menu">
            <li className="header">SITE</li>
            <li><Link to="/charts"><i className="fa fa-bar-chart"></i> Charts</Link></li>
            <li><Link to="/pages"><i className="fa fa-file"></i> Pages</Link></li>
            <li className="header">DATA</li>
            <li><Link to="/import"><i className="fa fa-upload"></i> Import CSV</Link></li>
            <li><Link to="/datasets"><i className="fa fa-table"></i> Datasets</Link></li>
            <li><Link to="/variables"><i className="fa fa-database"></i> Variables</Link></li>
            <li><Link to="/standardize"><i className="fa fa-globe"></i> Country tool</Link></li>
            <li><Link to="/tags"><i className="fa fa-tag"></i> Tags</Link></li>
            <li className="header">SETTINGS</li>
            <li><Link to="/users/"><i className="fa fa-users"></i> Users</Link></li>
            <li><Link to="/redirects"><i className="fa fa-arrow-right"></i> Redirects</Link></li>
            <li><Link to="/test"><i className="fa fa-eye"/> Test</Link></li>
        </ul>
    </aside>
}
