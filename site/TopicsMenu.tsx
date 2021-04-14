import * as React from "react"
import { observable, action, IReactionDisposer, reaction } from "mobx"
import { observer } from "mobx-react"
import { flatten } from "../clientUtils/Util"
import { bind } from "decko"
import classnames from "classnames"
import { AmazonMenu } from "./AmazonMenu"
import { CategoryWithEntries, EntryMeta } from "../clientUtils/owidTypes"

const renderEntry = (entry: EntryMeta): JSX.Element => {
    return (
        <li key={entry.slug}>
            <a
                href={`/${entry.slug}`}
                className="item"
                data-track-note="header-navigation"
            >
                <span className="label">{entry.title}</span>
            </a>
        </li>
    )
}

const allEntries = (category: CategoryWithEntries): EntryMeta[] => {
    // combine "direct" entries and those from subcategories
    return [
        ...category.entries,
        ...flatten(
            category.subcategories.map((subcategory) => subcategory.entries)
        ),
    ]
}

@observer
export class TopicsMenu extends React.Component<{
    categories: CategoryWithEntries[]
}> {
    @observable.ref private activeCategory?: CategoryWithEntries
    private submenuRef: React.RefObject<HTMLUListElement> = React.createRef()

    @action.bound private setCategory(category?: CategoryWithEntries) {
        this.activeCategory = category
    }

    @observable.ref dropdownIsOpen = false

    dropdownOpenTimeoutId?: number // ID of the timeout that will set isOpen to true
    dropdownCloseTimeoutId?: number // ID of the timeout that will set isOpen to false
    dropdownLastOpened?: number // Timestamp of the last time isOpen was set to true

    dispose!: IReactionDisposer

    componentDidMount() {
        this.dispose = reaction(
            () => this.dropdownIsOpen,
            () => {
                if (this.dropdownIsOpen) this.dropdownLastOpened = Date.now()
            }
        )
    }

    componentWillUnmount() {
        this.dispose()
    }

    @action.bound setOpen(open: boolean) {
        this.dropdownIsOpen = open
        this.clearOpenTimeout()
        this.clearCloseTimeout()
    }

    @action.bound scheduleOpenTimeout(delay: number) {
        this.dropdownOpenTimeoutId = window.setTimeout(
            () => this.setOpen(true),
            delay
        )
        this.clearCloseTimeout()
    }

    @action.bound scheduleCloseTimeout(delay: number) {
        this.dropdownCloseTimeoutId = window.setTimeout(
            () => this.setOpen(false),
            delay
        )
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

    @action.bound onDropdownButtonClick(
        event: React.MouseEvent<HTMLAnchorElement>
    ) {
        event.preventDefault()
        // Only close the menu if it's been open for a while, to avoid accidentally closing it while it's appearing.
        if (
            this.dropdownIsOpen &&
            this.dropdownLastOpened !== undefined &&
            this.dropdownLastOpened + 500 < Date.now()
        ) {
            this.setOpen(false)
        } else {
            this.setOpen(true)
        }
    }

    @bind private onActivate(categorySlug: string) {
        if (!categorySlug) return

        const category = this.props.categories.find(
            (cat) => cat.slug === categorySlug
        )
        if (category) this.setCategory(category)
    }

    @bind private onDeactivate(categorySlug: string) {
        if (!categorySlug) return

        const category = this.props.categories.find(
            (cat) => cat.slug === categorySlug
        )
        if (category === this.activeCategory) this.setCategory(undefined)
    }

    render() {
        const { activeCategory } = this
        const { categories } = this.props

        let subcolumnCountClass = ""

        if (activeCategory) {
            subcolumnCountClass =
                // Count root and subcategories entries
                activeCategory.subcategories.reduce(
                    (acc: number, subcategory) =>
                        subcategory.entries.length + acc,
                    activeCategory.entries.length
                ) > 10
                    ? "many-subcolumn"
                    : "one-subcolumn"
        }

        return (
            <div className="topics-button-wrapper">
                <a
                    href="/#entries"
                    className={classnames("topics-button", {
                        active: this.dropdownIsOpen,
                    })}
                    onMouseEnter={() => this.scheduleOpenTimeout(200)}
                    onMouseLeave={() => this.scheduleCloseTimeout(100)}
                    onClick={this.onDropdownButtonClick}
                >
                    <span className="label">Topics</span>
                    <span className="icon">
                        <svg width="12" height="6">
                            <path d="M0,0 L12,0 L6,6 Z" fill="currentColor" />
                        </svg>
                    </span>
                </a>
                <div
                    className={classnames(
                        "topics-dropdown",
                        subcolumnCountClass,
                        {
                            open: this.dropdownIsOpen,
                        }
                    )}
                    onMouseEnter={() => this.setOpen(true)}
                    onMouseLeave={() => this.scheduleCloseTimeout(350)}
                    aria-hidden={this.dropdownIsOpen}
                >
                    <div className="menu">
                        <AmazonMenu
                            onActivate={this.onActivate}
                            onDeactivate={this.onDeactivate}
                            activeSubmenuId={activeCategory?.slug}
                            submenuRect={
                                this.submenuRef.current &&
                                this.submenuRef.current.getBoundingClientRect()
                            }
                        >
                            <ul>
                                {categories.map((category) => (
                                    <li
                                        key={category.slug}
                                        className={
                                            category === activeCategory
                                                ? "active item"
                                                : "item"
                                        }
                                        data-submenu-id={category.slug}
                                    >
                                        <span className="label-icon">
                                            <span className="label">
                                                {category.name}
                                            </span>
                                            <span className="icon">
                                                <svg width="5" height="10">
                                                    <path
                                                        d="M0,0 L5,5 L0,10 Z"
                                                        fill="currentColor"
                                                    />
                                                </svg>
                                            </span>
                                        </span>
                                        {category === activeCategory && (
                                            <ul
                                                className={`submenu ${subcolumnCountClass}`}
                                                ref={this.submenuRef}
                                            >
                                                {allEntries(
                                                    activeCategory
                                                ).map((entry) =>
                                                    renderEntry(entry)
                                                )}
                                            </ul>
                                        )}
                                    </li>
                                ))}
                                {/* <hr />
                                <a
                                    href="http://sdg-tracker.org"
                                    className="item"
                                    data-submenu-id
                                    data-track-note="header-navigation"
                                >
                                    <span className="label">
                                        Sustainable Development Goals Tracker
                                    </span>
                                    <span className="icon">
                                        <FontAwesomeIcon
                                            icon={faExternalLinkAlt}
                                        />
                                    </span>
                                </a> */}
                                {/* An extra "Index" menu item, for when we have the Index page. */}
                                {/* <a href="/index" className="item" data-track-note="header-navigation">
                        <span className="label">Index of all topics</span>
                        <span className="icon">
                            <FontAwesomeIcon icon={faExternalLinkAlt} />
                        </span>
                    </a> */}
                            </ul>
                        </AmazonMenu>
                    </div>
                </div>
            </div>
        )
    }
}
