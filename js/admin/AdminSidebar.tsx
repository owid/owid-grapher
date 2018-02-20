import Admin from './Admin'
import Link from './Link'
import * as React from 'react'

export default function AdminSidebar(props: { onDismiss: () => void }) {
    return <aside className="AdminSidebar">
        <ul className="sidebar-menu">
            <li className="header">CHARTS</li>
            <li><Link onClick={props.onDismiss} to="/"><i className="fa fa-bar-chart"></i> Charts</Link></li>
            <li className="header">IMPORT</li>
            <li><Link onClick={props.onDismiss} to="/import"><i className="fa fa-upload"></i> Import new data</Link></li>
            <li className="header">DATA MANAGEMENT</li>
            <li><Link native to="/datasets"><i className="fa fa-table"></i> Datasets</Link></li>
            <li><Link native to="/grapher/admin/standardize"><i className="fa fa-flag"></i> Country name tool</Link></li>
            <li><Link native to="/grapher/admin/datasets/history/all"><i className="fa fa-history"></i> Version history</Link></li>
            <li className="header">SETTINGS</li>
            <li><Link onClick={props.onDismiss} to="/users/"><i className="fa fa-users"></i> Users</Link></li>
            <li><Link native to="/grapher/admin/categories/"><i className="fa fa-folder"></i> Categories</Link></li>
        </ul>
    </aside>
}
