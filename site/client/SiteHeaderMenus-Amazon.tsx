import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { observable, runInAction, action } from 'mobx'
import { observer } from 'mobx-react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch, faBars, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons'
import classnames from 'classnames'
import { find } from 'lodash'
import { bind } from 'decko'

import { AmazonMenu } from './AmazonMenu'

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
export class DesktopTopicsMenu extends React.Component<{ categories: CategoryWithEntries[], isOpen: boolean, onMouseEnter: (ev: React.MouseEvent<HTMLDivElement>) => void, onMouseLeave: (ev: React.MouseEvent<HTMLDivElement>) => void }> {
    @observable.ref activeCategory?: CategoryWithEntries
    submenuRef: React.RefObject<HTMLDivElement> = React.createRef()

    @action.bound setCategory(category: CategoryWithEntries) {
        this.activeCategory = category
    }

    @bind onActivate(categorySlug: string) {
        if (categorySlug) {
            const category = find(this.props.categories, (c) => c.slug === categorySlug)
            if (category) this.setCategory(category)
        }
    }

    render() {
        const { activeCategory } = this
        const { categories, isOpen, onMouseEnter, onMouseLeave } = this.props

        let sizeClass = ""

        if (activeCategory) {
            sizeClass = activeCategory.entries.length > 10 ? "two-column": "one-column"
        }

        return <div className={classnames("topics-dropdown", sizeClass, { "open": isOpen })} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} aria-hidden={isOpen}>
            <div className="menu">
                <AmazonMenu
                    onActivate={this.onActivate}
                    submenuRect={this.submenuRef.current && this.submenuRef.current.getBoundingClientRect()}
                >
                    {categories.map((category) => <CategoryItem key={category.name} category={category} active={category === activeCategory} />)}
                </AmazonMenu>
                <hr />
                <a href="/index" className="item">
                    <span className="label">Index of all topics</span>
                    <span className="icon">
                        <FontAwesomeIcon icon={faExternalLinkAlt} />
                    </span>
                </a>
            </div>
            <div className="submenu" ref={this.submenuRef}>
                {activeCategory && activeCategory.entries.map((entry) => <a key={entry.title} href={`/${entry.slug}`} className="item">
                    <span className="label">{entry.title}</span>
                </a>)}
            </div>
        </div>
    }
}

class CategoryItem extends React.Component<{ category: CategoryWithEntries, active: boolean }> {
    render() {
        const { category, active } = this.props
        return <div className={active ? "active item" : "item"} data-submenu-id={category.slug}>
            <span className="label">{category.name}</span>
            <span className="icon">
                <svg width="5" height="10"><path d="M0,0 L5,5 L0,10 Z" fill="currentColor" /></svg>
            </span>
        </div>
    }
}

@observer
export class DesktopHeader extends React.Component<{ categories: CategoryWithEntries[] }> {
    @observable.ref dropdownIsOpen: boolean = false
    dropdownTimeout?: number

    @action.bound setOpen(open: boolean) {
        this.dropdownIsOpen = open
        this.clearCloseTimeout()
    }

    @action.bound scheduleCloseTimeout(delay: number) {
        this.dropdownTimeout = window.setTimeout(() => this.setOpen(false), delay)
    }

    @action.bound clearCloseTimeout() {
        if (this.dropdownTimeout) {
            clearTimeout(this.dropdownTimeout)
            this.dropdownTimeout = undefined
        }
    }

    render() {
        const {categories} = this.props

        return <React.Fragment>
            <div className="topics-button-wrapper">
                <button
                    className={classnames("topics-button", { "active": this.dropdownIsOpen })}
                    onMouseEnter={() => this.setOpen(true)}
                    onMouseLeave={() => this.scheduleCloseTimeout(100)}
                    onClick={() => this.setOpen(true)}
                >
                    <div className="label">
                        Research <br /><strong>by topic</strong>
                    </div>
                    <div className="icon">
                        <svg width="12" height="6"><path d="M0,0 L12,0 L6,6 Z" fill="currentColor" /></svg>
                    </div>
                </button>
                <DesktopTopicsMenu categories={categories} isOpen={this.dropdownIsOpen} onMouseEnter={() => this.setOpen(true)} onMouseLeave={() => this.scheduleCloseTimeout(350)} />
            </div>
            <div>
                <div className="site-primary-navigation">
                    <div className="site-search">
                        <input type="search" placeholder="Search..." />
                        <div className="search-icon">
                            <FontAwesomeIcon icon={faSearch} />
                        </div>
                    </div>
                    <ul className="site-primary-links">
                        <li><a href="/blog">Blog</a></li>
                        <li><a href="/about">About</a></li>
                        <li><a href="/support">Donate</a></li>
                    </ul>
                </div>
                <div className="site-secondary-navigation">
                    <ul className="site-secondary-links">
                        <li><a href="/charts">All charts and research</a></li>
                        <li><a href="/teaching">Teaching material</a></li>
                        <li><a href="https://sdg-tracker.org">Sustainable Development Goals</a></li>
                    </ul>
                </div>
            </div>
        </React.Fragment>
    }
}

// @observer
// export class MobileEntriesMenu extends React.Component<{ categories: CategoryWithEntries[] }> {
//     @observable.ref activeCategory?: CategoryWithEntries

//     @action.bound toggleCategory(category: CategoryWithEntries) {
//         if (this.activeCategory === category)
//             this.activeCategory = undefined
//         else
//             this.activeCategory = category
//     }

//     render() {
//         const {categories} = this.props
//         const {activeCategory} = this

//         return <div id="topics-dropdown" className="mobile">
//             <ul>
//                 <li className="header">
//                     <h2>Entries</h2>
//                 </li>
//                 {categories.map(category =>
//                     <li key={category.slug} className="category">
//                         <a onClick={() => this.toggleCategory(category)}><span>{category.name}</span></a>
//                         {activeCategory === category && <div className="subcategory-menu">
//                             <ul>
//                                 {category.entries.map(entry => {
//                                     return <li key={entry.slug}>
//                                         <a className={entry.starred ? "starred" : undefined} title={entry.starred ? "Starred pages are our best and most complete entries." : undefined} href={`/${entry.slug}`}>{entry.title}</a>
//                                     </li>
//                                 })}
//                             </ul>
//                         </div>}
//                     </li>
//                 )}
//                 <li className="end-link"><a href="/charts">Charts</a></li>
//                 <li className="end-link"><a href="https://sdg-tracker.org">SDGs</a></li>
//                 <li className="end-link"><a href="/blog">Blog</a></li>
//                 <li className='end-link'><a href='/about'>About</a></li>
//                 <li className='end-link'><a href='/teaching'>Teaching</a></li>
//                 <li className='end-link'><a href='/support'>Donate</a></li>
//             </ul>
//         </div>
//     }
// }

// @observer
// export class MobileHeader extends React.Component<{ categories: CategoryWithEntries[] }> {
//     @observable showSearch: boolean = false
//     @observable showCategories: boolean = false

//     @action.bound onToggleSearch() {
//         this.showSearch = !this.showSearch
//     }

//     @action.bound onToggleCategories() {
//         this.showCategories = !this.showCategories
//     }

//     render() {
//         return <React.Fragment>
//             <nav id="owid-topbar">
//                 <a className="logo" href="/">Our World in Data</a>
//                 <ul className="mobile">
//                     <li className="nav-button">
//                         <a onClick={this.onToggleSearch}><FontAwesomeIcon icon={faSearch}/></a>
//                     </li><li className="nav-button">
//                         <a onClick={this.onToggleCategories} data-expand="#topics-dropdown" className='mobile'><FontAwesomeIcon icon={faBars}/></a>
//                     </li>
//                 </ul>
//             </nav>
//             {this.showSearch && <div id="search-dropdown" className="mobile">
//                 <form id="search-nav" action="https://google.com/search" method="GET">
//                     <input type="hidden" name="sitesearch" value="ourworldindata.org" />
//                     <input type="search" name="q" placeholder="Search..." autoFocus/>
//                 </form>
//             </div>}
//             {this.showCategories && <MobileEntriesMenu categories={this.props.categories}/>}
//         </React.Fragment>
//     }
// }

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
        // return this.width > 1060 ? <DesktopHeader categories={this.props.categories}/> : <MobileHeader categories={this.props.categories}/>
        return <DesktopHeader categories={this.props.categories}/>
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

        ReactDOM.render(<SiteHeaderMenus categories={json.categories}/>, document.querySelector(".site-navigation"))
    }
}

export function runHeaderMenus() {
    const header = new HeaderMenus()
    header.run()
}
