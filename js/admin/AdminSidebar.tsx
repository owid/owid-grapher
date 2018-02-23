import Admin from './Admin'
import Link from './Link'
import * as React from 'react'

export default function AdminSidebar(props: { onDismiss: () => void }) {
    return <aside className="AdminSidebar">
        <ul className="sidebar-menu">
            <li className="header">CHARTS</li>
            <li><Link to="/"><i className="fa fa-bar-chart"></i> Charts</Link></li>
            <li className="header">DATA</li>
            <li><Link to="/import"><i className="fa fa-upload"></i> Import CSV</Link></li>
            <li><Link to="/datasets"><i className="fa fa-table"></i> Datasets</Link></li>
            <li><Link to="/variables"><i className="fa fa-database"></i> Variables</Link></li>
            <li><a href="/grapher/admin/standardize"><i className="fa fa-flag"></i> Country name tool</a></li>
            <li><a href="/grapher/admin/datasets/history/all"><i className="fa fa-history"></i> Version history</a></li>
            <li className="header">SETTINGS</li>
            <li><Link to="/users/"><i className="fa fa-users"></i> Users</Link></li>
            <li><a href="/grapher/admin/categories/"><i className="fa fa-folder"></i> Categories</a></li>
        </ul>
    </aside>
}
