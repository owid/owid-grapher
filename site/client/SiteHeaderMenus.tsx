import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { observable, action, reaction, runInAction, IReactionDisposer } from 'mobx'
import { observer } from 'mobx-react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { HeaderSearch } from './HeaderSearch'
import { faSearch, faBars, faExternalLinkAlt, faEnvelope, faAngleDown, faAngleUp } from '@fortawesome/free-solid-svg-icons'
import { CategoryWithEntries } from 'db/wpdb'
import classnames from 'classnames'
import { find } from 'lodash'
import { bind } from 'decko'

import { AmazonMenu } from './AmazonMenu'
import { faTwitter, faFacebook } from '@fortawesome/free-brands-svg-icons'

@observer
export class Header extends React.Component<{ categories: CategoryWithEntries[] }> {
    @observable.ref dropdownIsOpen: boolean = false

    dropdownOpenTimeoutId?: number  // ID of the timeout that will set isOpen to true
    dropdownCloseTimeoutId?: number // ID of the timeout that will set isOpen to false
    dropdownLastOpened?: number     // Timestamp of the last time isOpen was set to true

    // Mobile menu toggles
    @observable showSearch: boolean = false
    @observable showCategories: boolean = false

    dispose!: IReactionDisposer

    componentDidMount() {
        this.dispose = reaction(
            () => this.dropdownIsOpen,
            () => { if (this.dropdownIsOpen) this.dropdownLastOpened = Date.now() }
        )
    }

    componentWillUnmount() {
        this.dispose()
    }

    @action.bound onToggleSearch() {
        this.showSearch = !this.showSearch
    }

    @action.bound onToggleCategories() {
        this.showCategories = !this.showCategories
    }

    @action.bound setOpen(open: boolean) {
        this.dropdownIsOpen = open
        this.clearOpenTimeout()
        this.clearCloseTimeout()
    }

    @action.bound scheduleOpenTimeout(delay: number) {
        this.dropdownOpenTimeoutId = window.setTimeout(() => this.setOpen(true), delay)
        this.clearCloseTimeout()
    }

    @action.bound scheduleCloseTimeout(delay: number) {
        this.dropdownCloseTimeoutId = window.setTimeout(() => this.setOpen(false), delay)
        this.clearOpenTimeout()
    }

    @action.bound clearOpenTimeout() {
        if (this.dropdownOpenTimeoutId) {
            clearTimeout(this.dropdownOpenTimeoutId)
            this.dropdownOpenTimeoutId = undefined
        }
    }

    @action.bound clearCloseTimeout() {
        if (this.dropdownCloseTimeoutId) {
            clearTimeout(this.dropdownCloseTimeoutId)
            this.dropdownCloseTimeoutId = undefined
        }
    }

    @action.bound onDropdownButtonClick(event: React.MouseEvent<HTMLAnchorElement>) {
        event.preventDefault()
        // Only close the menu if it's been open for a while, to avoid accidentally closing it while it's appearing.
        if (this.dropdownIsOpen && this.dropdownLastOpened != null && this.dropdownLastOpened + 500 < Date.now()) {
            this.setOpen(false)
        } else {
            this.setOpen(true)
        }
    }

    render() {
        const {categories} = this.props

        return <React.Fragment>
            <div className="wrapper site-navigation-bar">
                <div className="site-logo">
                    <a href="/" data-track-click data-track-note="header-navigation">
                        Our World<br /> in Data
                    </a>
                </div>
                <nav className="site-navigation lg-only">
                    <div className="topics-button-wrapper">
                        <a
                            href="/#entries"
                            className={classnames("topics-button", { "active": this.dropdownIsOpen })}
                            onMouseEnter={() => this.scheduleOpenTimeout(200)}
                            onMouseLeave={() => this.scheduleCloseTimeout(100)}
                            onClick={this.onDropdownButtonClick}
                        >
                            <div className="label">
                                Research <br /><strong>by topic</strong>
                            </div>
                            <div className="icon">
                                <svg width="12" height="6"><path d="M0,0 L12,0 L6,6 Z" fill="currentColor" /></svg>
                            </div>
                        </a>
                        <DesktopTopicsMenu categories={categories} isOpen={this.dropdownIsOpen} onMouseEnter={() => this.setOpen(true)} onMouseLeave={() => this.scheduleCloseTimeout(350)} />
                    </div>
                    <div>
                        <div className="site-primary-navigation">
                            <HeaderSearch/>
                            <ul className="site-primary-links">
                                <li><a href="/blog" data-track-click data-track-note="header-navigation">Blog</a></li>
                                <li><a href="/about" data-track-click data-track-note="header-navigation">About</a></li>
                                <li><a href="/donate" data-track-click data-track-note="header-navigation">Donate</a></li>
                            </ul>
                        </div>
                        <div className="site-secondary-navigation">
                            <ul className="site-secondary-links">
                                <li><a href="/charts" data-track-click data-track-note="header-navigation">All charts</a></li>
                                <li><a href="/teaching" data-track-click data-track-note="header-navigation">Teaching material</a></li>
                                <li><a href="https://sdg-tracker.org" data-track-click data-track-note="header-navigation">Sustainable Development Goals</a></li>
                            </ul>
                        </div>
                    </div>
                </nav>
                <ul className="site-social-links lg-only">
                    <li>
                        <a href="https://twitter.com/ourworldindata" target="_blank" rel="noopener noreferrer" title="Follow us on Twitter" data-track-click data-track-note="header-navigation">
                            <FontAwesomeIcon icon={faTwitter} />
                        </a>
                    </li>
                    <li>
                        <a href="https://www.facebook.com/OurWorldinData/" target="_blank" rel="noopener noreferrer" title="Subscribe to our Facebook page" data-track-click data-track-note="header-navigation">
                            <FontAwesomeIcon icon={faFacebook} />
                        </a>
                    </li>
                    <li>
                        <a href="/subscribe" target="_blank" rel="noopener noreferrer" title="Subscribe to our newsletter" data-track-click data-track-note="header-navigation">
                            <FontAwesomeIcon icon={faEnvelope} />
                        </a>
                    </li>
                </ul>
                <div className="site-navigation sm-only">
                    <button className="button" onClick={this.onToggleSearch} data-track-click  data-track-note="mobile-search-button">
                        <FontAwesomeIcon icon={faSearch}/>
                    </button>
                    <button className="button" onClick={this.onToggleCategories} data-track-click  data-track-note="mobile-hamburger-button">
                        <FontAwesomeIcon icon={faBars}/>
                    </button>
                </div>
            </div>
            {this.showSearch && <div className="search-dropdown sm-only">
                <form id="search-nav" action="https://google.com/search" method="GET">
                    <input type="hidden" name="sitesearch" value="ourworldindata.org" />
                    <input type="search" name="q" placeholder="Search..." autoFocus />
                </form>
            </div>}
            {this.showCategories && <MobileTopicsMenu categories={this.props.categories}/>}
        </React.Fragment>
    }
}

@observer
export class DesktopTopicsMenu extends React.Component<{ categories: CategoryWithEntries[], isOpen: boolean, onMouseEnter: (ev: React.MouseEvent<HTMLDivElement>) => void, onMouseLeave: (ev: React.MouseEvent<HTMLDivElement>) => void }> {
    @observable.ref activeCategory?: CategoryWithEntries
    submenuRef: React.RefObject<HTMLDivElement> = React.createRef()

    @action.bound setCategory(category?: CategoryWithEntries) {
        this.activeCategory = category
    }

    @bind onActivate(categorySlug: string) {
        if (categorySlug) {
            const category = find(this.props.categories, (c) => c.slug === categorySlug)
            if (category) this.setCategory(category)
        }
    }

    @bind onDeactivate(categorySlug: string) {
        if (categorySlug) {
            const category = find(this.props.categories, (c) => c.slug === categorySlug)
            if (category === this.activeCategory) this.setCategory(undefined)
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
                    onDeactivate={this.onDeactivate}
                    submenuRect={this.submenuRef.current && this.submenuRef.current.getBoundingClientRect()}
                >
                    {categories.map((category) =>
                        <div key={category.slug} className={category === activeCategory ? "active item" : "item"} data-submenu-id={category.slug}>
                            <span className="label">
                                {category.name}
                            </span>
                            <span className="icon">
                                <svg width="5" height="10"><path d="M0,0 L5,5 L0,10 Z" fill="currentColor" /></svg>
                            </span>
                        </div>
                    )}
                    <hr />
                    <a href="http://sdg-tracker.org" className="item" data-submenu-id data-track-click data-track-note="header-navigation">
                        <span className="label">Sustainable Development Goals</span>
                        <span className="icon">
                            <FontAwesomeIcon icon={faExternalLinkAlt} />
                        </span>
                    </a>
                    {/* An extra "Index" menu item, for when we have the Index page. */}
                    {/* <a href="/index" className="item" data-track-click data-track-note="header-navigation">
                        <span className="label">Index of all topics</span>
                        <span className="icon">
                            <FontAwesomeIcon icon={faExternalLinkAlt} />
                        </span>
                    </a> */}
                </AmazonMenu>
            </div>
            <div className="submenu" ref={this.submenuRef}>
                {activeCategory && activeCategory.entries.map((entry) => <a key={entry.title} href={`/${entry.slug}`} className="item" data-track-click data-track-note="header-navigation">
                    <span className="label">{entry.title}</span>
                </a>)}
            </div>
        </div>
    }
}

@observer
export class MobileTopicsMenu extends React.Component<{ categories: CategoryWithEntries[] }> {
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
        return <div className="mobile-topics-dropdown sm-only">
            <ul>
                <li className="header">
                    <h2>Topics</h2>
                </li>
                {categories.map(category =>
                    <li key={category.slug} className="category">
                        <a onClick={() => this.toggleCategory(category)}>
                            <span className="label">{category.name}</span>
                            <span className="icon">
                                <FontAwesomeIcon icon={activeCategory === category ? faAngleUp : faAngleDown} />
                            </span>
                        </a>
                        {activeCategory === category && <div className="subcategory-menu">
                            <ul>
                                {category.entries.map(entry => {
                                    return <li key={entry.slug}>
                                        <a href={`/${entry.slug}`} data-track-click data-track-note="header-navigation">{entry.title}</a>
                                    </li>
                                })}
                            </ul>
                        </div>}
                    </li>
                )}
                <li className="end-link"><a href="/charts" data-track-click data-track-note="header-navigation">Charts</a></li>
                <li className="end-link"><a href="/teaching" data-track-click data-track-note="header-navigation">Teaching material</a></li>
                <li className="end-link"><a href="https://sdg-tracker.org" data-track-click data-track-note="header-navigation">Sustainable Development Goals</a></li>
                <li className="end-link"><a href="/blog" data-track-click data-track-note="header-navigation">Blog</a></li>
                <li className="end-link"><a href="/about" data-track-click data-track-note="header-navigation">About</a></li>
                <li className="end-link"><a href="/donate" data-track-click data-track-note="header-navigation">Donate</a></li>
            </ul>
        </div>
    }
}

@observer
export class SiteHeaderMenus extends React.Component {
    @observable width!: number
    @observable.ref categories: CategoryWithEntries[] = []

    @action.bound onResize() {
        this.width = window.innerWidth
    }

    async getEntries() {
        const json = await (await fetch("/headerMenu.json", {
            method: "GET",
            credentials: 'same-origin',
            headers: {
                "Accept": "application/json"
            }
        })).json()

        runInAction(() => this.categories = json.categories)
    }

    componentDidMount() {
        this.getEntries()
        this.onResize()
        window.addEventListener('resize', this.onResize)
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.onResize)
    }

    render() {
        return <Header categories={this.categories}/>
    }
}

export function runHeaderMenus() {
    ReactDOM.render(<SiteHeaderMenus/>, document.querySelector(".site-header"))
}
