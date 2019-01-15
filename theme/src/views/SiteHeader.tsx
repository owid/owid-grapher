import * as React from 'react'
import { CategoryWithEntries, EntryMeta } from '../wpdb'
import * as _ from 'lodash'
import { faSearch, faBars } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {decodeHTML} from 'entities'
var slugify = require('slugify')

export const SiteHeader = () => {
    const categoryOrder = [
        "Population",
        "Health",
        "Food" ,
        "Energy",
        "Environment",
        "Technology",
        "Growth &amp; Inequality",
        "Work &amp; Life",
        "Public Sector",
        "Global Connections",
        "War &amp; Peace",
        "Politics" ,
        "Violence &amp; Rights",
        "Education",
        "Media",
        "Culture"
    ]

    const categories = categoryOrder.map(cat => {
        return {
            name: decodeHTML(cat),
            slug: slugify(decodeHTML(cat).toLowerCase())
        }
    })

    return <header className="SiteHeader">
        <nav id="owid-topbar">
            <a className="logo" href="/">Our World in Data</a>
            <ul className="desktop">
                <li>
                    <form id="search-nav" action="https://google.com/search" method="GET">
                        <input type="hidden" name="sitesearch" value="ourworldindata.org" />
                        <input type="search" name="q" placeholder="Search..." />
                    </form>
                </li>
                <li><a href="/charts">Charts</a></li>
                <li><a href="https://sdg-tracker.org" title="Sustainable Development Goals">SDGs</a></li>
                <li><a href="/blog">Blog</a></li>
                <li><a href="/about">About</a></li>
                <li><a href="/teaching">Teaching</a></li>
                <li><a href="/support">Donate</a></li>
            </ul>
            <ul className="mobile">
                <li className="nav-button">
                    <a data-expand="#search-dropdown"><FontAwesomeIcon icon={faSearch}/></a>
                </li><li className="nav-button">
                    <a data-expand="#topics-dropdown" className='mobile'><FontAwesomeIcon icon={faBars}/></a>
                </li>
            </ul>
        </nav>
        <div id="category-nav" className="desktop">
            <ul>
                {categories.map(category =>
                    <li key={category.slug} className="category" title={category.name}>
                        <a href={`/#${category.slug}`}><span>{category.name}</span></a>
                    </li>
                )}
            </ul>
        </div>
    </header>
}
