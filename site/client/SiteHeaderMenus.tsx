import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { observable, runInAction, action } from 'mobx'
import { observer } from 'mobx-react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch, faBars } from '@fortawesome/free-solid-svg-icons'
import { HeaderSearch } from './HeaderSearch'
export interface EntryMeta {
    slug: string
    title: string
    starred: boolean
}

export interface CategoryWithEntries {
    name: string
    slug: string
    entries: EntryMeta[]
}

@observer
export class DesktopHeader extends React.Component<{ categories: CategoryWithEntries[] }> {
    @observable.ref activeCategory?: CategoryWithEntries

    @action.bound setCategory(category: CategoryWithEntries) {
        this.activeCategory = category
    }
    
    render() {
        const {activeCategory} = this
        const {categories} = this.props

        return <React.Fragment>
            <nav id="owid-topbar">
                <a className="logo" href="/">Our World in Data</a>
                <ul className="desktop">
                    <li>
                        <HeaderSearch/>
                    </li>
                    <li><a href="/charts">Charts</a></li>
                    <li><a href="https://sdg-tracker.org" title="Sustainable Development Goals">SDGs</a></li>
                    <li><a href="/blog">Blog</a></li>
                    <li><a href="/about">About</a></li>
                    <li><a href="/teaching">Teaching</a></li>
                    <li><a href="/support">Donate</a></li>
                </ul>
            </nav>
            <div id="category-nav" className="desktop">
                <ul>
                    {categories.map(category =>
                        <li key={category.slug} className={`category` + (activeCategory === category ? " active" : "")} title={category.name}>
                            <a onClick={() => this.setCategory(category)}><span>{category.name}</span></a>
                            <ul className="entries">
                                <li><hr/></li>
                                {category.entries.map(entry =>
                                    <li key={entry.slug}><a className={entry.starred ? "starred" : undefined} title={entry.starred ? "Starred pages are our best and most complete entries." : undefined} href={`/${entry.slug}`}>{entry.title}</a></li>
                                )}
                            </ul>
                        </li>
                    )}
                </ul>
            </div>
            <div id="entries-nav" className="desktop">
                {activeCategory && <React.Fragment>
                    <li key={0}><hr/></li>
                    {activeCategory.entries.map(entry => {
                        const classes = []
                        return <li key={entry.slug}>
                            <a className={entry.starred ? "starred" : undefined} title={entry.starred ? "Starred pages are our best and most complete entries." : undefined} href={`/${entry.slug}`}>{entry.title}</a>
                        </li>
                    })}
                </React.Fragment>}
            </div>
        </React.Fragment>
    }
}

@observer
export class MobileEntriesMenu extends React.Component<{ categories: CategoryWithEntries[] }> {
    @observable.ref activeCategory?: CategoryWithEntries

    @action.bound toggleCategory(category: CategoryWithEntries) {
        if (this.activeCategory === category)
            this.activeCategory = undefined
        else
            this.activeCategory = category
    }

    render() {
        const {categories} = this.props 
        const {activeCategory} = this
        
        return <div id="topics-dropdown" className="mobile">
            <ul>
                <li className="header">
                    <h2>Entries</h2>
                </li>
                {categories.map(category =>
                    <li key={category.slug} className="category">
                        <a onClick={() => this.toggleCategory(category)}><span>{category.name}</span></a>
                        {activeCategory === category && <div className="subcategory-menu">
                            <ul>
                                {category.entries.map(entry => {
                                    return <li key={entry.slug}>
                                        <a className={entry.starred ? "starred" : undefined} title={entry.starred ? "Starred pages are our best and most complete entries." : undefined} href={`/${entry.slug}`}>{entry.title}</a>
                                    </li>
                                })}
                            </ul>
                        </div>}
                    </li>
                )}
                <li className="end-link"><a href="/charts">Charts</a></li>
                <li className="end-link"><a href="https://sdg-tracker.org">SDGs</a></li>
                <li className="end-link"><a href="/blog">Blog</a></li>
                <li className='end-link'><a href='/about'>About</a></li>
                <li className='end-link'><a href='/teaching'>Teaching</a></li>
                <li className='end-link'><a href='/support'>Donate</a></li>
            </ul>
        </div>
    }
}

@observer
export class MobileHeader extends React.Component<{ categories: CategoryWithEntries[] }> {
    @observable showSearch: boolean = false
    @observable showCategories: boolean = false

    @action.bound onToggleSearch() {
        this.showSearch = !this.showSearch
    }

    @action.bound onToggleCategories() {
        this.showCategories = !this.showCategories
    }

    render() {
        return <React.Fragment>
            <nav id="owid-topbar">
                <a className="logo" href="/">Our World in Data</a>
                <ul className="mobile">
                    <li className="nav-button">
                        <a onClick={this.onToggleSearch}><FontAwesomeIcon icon={faSearch}/></a>
                    </li><li className="nav-button">
                        <a onClick={this.onToggleCategories} data-expand="#topics-dropdown" className='mobile'><FontAwesomeIcon icon={faBars}/></a>
                    </li>
                </ul>
            </nav>
            {this.showSearch && <div id="search-dropdown" className="mobile">
                <form id="search-nav" action="https://google.com/search" method="GET">
                    <input type="hidden" name="sitesearch" value="ourworldindata.org" />
                    <input type="search" name="q" placeholder="Search..." autoFocus/>
                </form>
            </div>}
            {this.showCategories && <MobileEntriesMenu categories={this.props.categories}/>}
        </React.Fragment>
    }
}

@observer
export class SiteHeaderMenus extends React.Component<{ categories: CategoryWithEntries[] }> {
    @observable width!: number

    @action.bound onResize() {
        this.width = window.innerWidth
    }

    componentDidMount() {
        this.onResize()
        window.addEventListener('resize', this.onResize)
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.onResize)
    }

    render() {
        return this.width > 1060 ? <DesktopHeader categories={this.props.categories}/> : <MobileHeader categories={this.props.categories}/>
    }
}

export class HeaderMenus {
    async run() {
        const json = await (await fetch("/headerMenu.json", {
            method: "GET",
            credentials: 'same-origin',
            headers: {
                "Accept": "application/json"
            }
        })).json()

        ReactDOM.render(<SiteHeaderMenus categories={json.categories}/>, document.querySelector(".SiteHeader"))
    }
}

export function runHeaderMenus() {
    const header = new HeaderMenus()
    header.run()
}


