import Admin from './Admin'
import Link from './Link'
import * as React from 'react'

export default function AdminSidebar() {
    return <aside className="AdminSidebar">
        <ul className="sidebar-menu">
            <li className="header">CHARTS</li>
            <li><Link to="/"><i className="fa fa-bar-chart"></i> Charts</Link></li>
            <li className="header">IMPORT</li>
            <li><Link to="/import"><i className="fa fa-upload"></i> Import new data</Link></li>
            <li className="header">DATA MANAGEMENT</li>
            <li><Link to="/datasets"><i className="fa fa-table"></i> Datasets</Link></li>
            <li><Link to="/datasets_treeview"><i className="fa fa-list-ul"></i> Datasets by categories</Link></li>
            <li><Link to="/wb/wdidatasets"><i className="fa fa-database"></i> WDI Datasets</Link></li>
            <li><Link to="/unwppdatasets"><i className="fa fa-database"></i> UN WPP Datasets</Link></li>
            <li><Link to="/qogdatasets"><i className="fa fa-database"></i> QOG Datasets</Link></li>
            <li><Link to="/faodatasets"><i className="fa fa-database"></i> FAOSTAT Datasets</Link></li>
            <li><Link to="/clioinfradatasets"><i className="fa fa-database"></i> Clio-Infra Datasets</Link></li>
            <li><Link to="/wb/edstatsdatasets"><i className="fa fa-database"></i> EdStats Datasets</Link></li>
            <li><Link to="/wb/genderstatsdatasets"><i className="fa fa-database"></i> Gender Stats Datasets</Link></li>
            <li><Link to="/wb/hnpstatsdatasets"><i className="fa fa-database"></i> WB HNP Datasets</Link></li>
            <li><Link to="/wb/findexdatasets"><i className="fa fa-database"></i> WB FINDEX Datasets</Link></li>
            <li><Link to="/wb/bbscdatasets"><i className="fa fa-database"></i> WB BBSC Datasets</Link></li>
            <li><Link to="/wb/povstatsdatasets"><i className="fa fa-database"></i> WB POVSTATS Datasets</Link></li>
            <li><Link to="/wb/climatechdatasets"><i className="fa fa-database"></i> WB Climate Datasets</Link></li>
            <li><Link to="/wb/hnpqstatsdatasets"><i className="fa fa-database"></i> WB HNPQ Datasets</Link></li>
            <li><Link to="/wb/se4alldatasets"><i className="fa fa-database"></i> WB SE4ALL Datasets</Link></li>
            <li><Link to="/wb/aspiredatasets"><i className="fa fa-database"></i> WB ASPIRE Datasets</Link></li>
            <li><Link to="/gbdcausedatasets"><i className="fa fa-database"></i> GBD Cause Datasets</Link></li>
            <li><Link to="/gbdriskdatasets"><i className="fa fa-database"></i> GBD Risk Datasets</Link></li>
            <li><Link to="/ilostatdatasets"><i className="fa fa-database"></i> ILOSTAT Datasets</Link></li>
            <li><Link to="/standardize"><i className="fa fa-flag"></i> Country name tool</Link></li>
            <li><Link to="/datasets/history/all"><i className="fa fa-history"></i> Version history</Link></li>
            <li className="header">SETTINGS</li>
            <li><Link to="/users/"><i className="fa fa-users"></i> Users</Link></li>
            <li><Link to="/categories/"><i className="fa fa-folder"></i> Categories</Link></li>
        </ul>
    </aside>
}