import Admin from './Admin'
import * as React from 'react'



export default function AdminSidebar(props: { admin: Admin }) {
    const {url} = props.admin

    return <aside className="main-sidebar">
    <section className="sidebar" style="height: auto;">
        <ul className="sidebar-menu">
            <li className="header">CHARTS</li>
            <li><Link href="/"><i className="fa fa-bar-chart"></i> Charts</Link></li>
            <li className="header">IMPORT</li>
            <li><Link href="/import"><i className="fa fa-upload"></i> Import new data</Link></li>
            <li className="header">DATA MANAGEMENT</li>
            <li><Link href="/datasets"><i className="fa fa-table"></i> Datasets</Link></li>
            <li><Link href="/datasets_treeview"><i className="fa fa-list-ul"></i> Datasets by categories</Link></li>
            <li><Link href="/wb/wdidatasets"><i className="fa fa-database"></i> WDI Datasets</Link></li>
            <li><Link href="/unwppdatasets"><i className="fa fa-database"></i> UN WPP Datasets</Link></li>
            <li><Link href="/qogdatasets"><i className="fa fa-database"></i> QOG Datasets</Link></li>
            <li><Link href="/faodatasets"><i className="fa fa-database"></i> FAOSTAT Datasets</Link></li>
            <li><Link href="/clioinfradatasets"><i className="fa fa-database"></i> Clio-Infra Datasets</Link></li>
            <li><Link href="/wb/edstatsdatasets"><i className="fa fa-database"></i> EdStats Datasets</Link></li>
            <li><Link href="/wb/genderstatsdatasets"><i className="fa fa-database"></i> Gender Stats Datasets</Link></li>
            <li><Link href="/wb/hnpstatsdatasets"><i className="fa fa-database"></i> WB HNP Datasets</Link></li>
            <li><Link href="/wb/findexdatasets"><i className="fa fa-database"></i> WB FINDEX Datasets</Link></li>
            <li><Link href="/wb/bbscdatasets"><i className="fa fa-database"></i> WB BBSC Datasets</Link></li>
            <li><Link href="/wb/povstatsdatasets"><i className="fa fa-database"></i> WB POVSTATS Datasets</Link></li>
            <li><Link href="/wb/climatechdatasets"><i className="fa fa-database"></i> WB Climate Datasets</Link></li>
            <li><Link href="/wb/hnpqstatsdatasets"><i className="fa fa-database"></i> WB HNPQ Datasets</Link></li>
            <li><Link href="/wb/se4alldatasets"><i className="fa fa-database"></i> WB SE4ALL Datasets</Link></li>
            <li><Link href="/wb/aspiredatasets"><i className="fa fa-database"></i> WB ASPIRE Datasets</Link></li>
            <li><Link href="/gbdcausedatasets"><i className="fa fa-database"></i> GBD Cause Datasets</Link></li>
            <li><Link href="/gbdriskdatasets"><i className="fa fa-database"></i> GBD Risk Datasets</Link></li>
            <li><Link href="/ilostatdatasets"><i className="fa fa-database"></i> ILOSTAT Datasets</Link></li>
            <li><Link href="/standardize"><i className="fa fa-flag"></i> Country name tool</Link></li>
            <li><Link href="/datasets/history/all"><i className="fa fa-history"></i> Version history</Link></li>
            <li className="header">SETTINGS</li>
            <li><Link href="/users/"><i className="fa fa-users"></i> Users</Link></li>
            <li><Link href="/categories/"><i className="fa fa-folder"></i> Categories</Link></li>
        </ul>
    </section>
  </aside>
}