import Admin from './Admin'
import Link from './Link'
import * as React from 'react'

export default function AdminSidebar() {
    return <aside className="AdminSidebar">
        <ul className="sidebar-menu">
            <li className="header">CHARTS</li>
            <li><Link to="/"><i className="fa fa-bar-chart"></i> Charts</Link></li>
            <li className="header">IMPORT</li>
            <li><Link native to="/import"><i className="fa fa-upload"></i> Import new data</Link></li>
            <li className="header">DATA MANAGEMENT</li>
            <li><Link native to="/datasets"><i className="fa fa-table"></i> Datasets</Link></li>
            <li><Link native to="/datasets_treeview"><i className="fa fa-list-ul"></i> Datasets by categories</Link></li>
            <li><Link native to="/wb/wdidatasets"><i className="fa fa-database"></i> WDI Datasets</Link></li>
            <li><Link native to="/unwppdatasets"><i className="fa fa-database"></i> UN WPP Datasets</Link></li>
            <li><Link native to="/qogdatasets"><i className="fa fa-database"></i> QOG Datasets</Link></li>
            <li><Link native to="/faodatasets"><i className="fa fa-database"></i> FAOSTAT Datasets</Link></li>
            <li><Link native to="/clioinfradatasets"><i className="fa fa-database"></i> Clio-Infra Datasets</Link></li>
            <li><Link native to="/wb/edstatsdatasets"><i className="fa fa-database"></i> EdStats Datasets</Link></li>
            <li><Link native to="/wb/genderstatsdatasets"><i className="fa fa-database"></i> Gender Stats Datasets</Link></li>
            <li><Link native to="/wb/hnpstatsdatasets"><i className="fa fa-database"></i> WB HNP Datasets</Link></li>
            <li><Link native to="/wb/findexdatasets"><i className="fa fa-database"></i> WB FINDEX Datasets</Link></li>
            <li><Link native to="/wb/bbscdatasets"><i className="fa fa-database"></i> WB BBSC Datasets</Link></li>
            <li><Link native to="/wb/povstatsdatasets"><i className="fa fa-database"></i> WB POVSTATS Datasets</Link></li>
            <li><Link native to="/wb/climatechdatasets"><i className="fa fa-database"></i> WB Climate Datasets</Link></li>
            <li><Link native to="/wb/hnpqstatsdatasets"><i className="fa fa-database"></i> WB HNPQ Datasets</Link></li>
            <li><Link native to="/wb/se4alldatasets"><i className="fa fa-database"></i> WB SE4ALL Datasets</Link></li>
            <li><Link native to="/wb/aspiredatasets"><i className="fa fa-database"></i> WB ASPIRE Datasets</Link></li>
            <li><Link native to="/gbdcausedatasets"><i className="fa fa-database"></i> GBD Cause Datasets</Link></li>
            <li><Link native to="/gbdriskdatasets"><i className="fa fa-database"></i> GBD Risk Datasets</Link></li>
            <li><Link native to="/ilostatdatasets"><i className="fa fa-database"></i> ILOSTAT Datasets</Link></li>
            <li><Link native to="/standardize"><i className="fa fa-flag"></i> Country name tool</Link></li>
            <li><Link native to="/datasets/history/all"><i className="fa fa-history"></i> Version history</Link></li>
            <li className="header">SETTINGS</li>
            <li><Link native to="/users/"><i className="fa fa-users"></i> Users</Link></li>
            <li><Link native to="/categories/"><i className="fa fa-folder"></i> Categories</Link></li>
        </ul>
    </aside>
}