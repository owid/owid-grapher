import Admin from './Admin'
import Link from './Link'
import * as React from 'react'

export default function AdminSidebar(props: { onDismiss: () => void }) {
    return <aside className="AdminSidebar">
        <ul className="sidebar-menu">
            <li className="header">SITE</li>
            <li><Link to="/charts"><i className="fa fa-bar-chart"></i> Charts</Link></li>
            <li><Link to="/pages"><i className="fa fa-file"></i> Pages</Link></li>
            <li className="header">DATA</li>
            <li><a href="/grapher/admin/import"><i className="fa fa-upload"></i> Import CSV</a></li>
            <li><Link to="/datasets"><i className="fa fa-table"></i> Datasets</Link></li>
            <li><Link to="/variables"><i className="fa fa-database"></i> Variables</Link></li>
            <li><a href="/grapher/admin/standardize"><i className="fa fa-flag"></i> Country name tool</a></li>
            <li><a href="/grapher/admin/datasets/history/all"><i className="fa fa-history"></i> Version history</a></li>
            <li><Link to="/standardize"><i className="fa fa-globe"></i> Country tool (BETA)</Link></li>
            <li className="header">SETTINGS</li>
            <li><Link to="/users/"><i className="fa fa-users"></i> Users</Link></li>
            <li><Link to="/redirects"><i className="fa fa-arrow-right"></i> Redirects</Link></li>
            <li><a href="/grapher/admin/categories/"><i className="fa fa-folder"></i> Categories</a></li>
            <li><Link to="/test"><i className="fa fa-eye"/> Test</Link></li>
        </ul>
    </aside>
}
