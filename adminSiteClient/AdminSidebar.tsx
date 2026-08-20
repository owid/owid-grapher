import * as React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

import { Link } from "./Link.js"
import { ADMIN_NAV_SECTIONS, AdminNavEntry } from "./adminNav.js"

const NavEntryLink = ({
    entry,
}: {
    entry: AdminNavEntry
}): React.ReactElement => {
    const label = entry.smallText ? (
        <span style={{ fontSize: 12 }}>{entry.title}</span>
    ) : (
        entry.title
    )
    if (entry.to)
        return (
            <Link to={entry.to}>
                <FontAwesomeIcon icon={entry.icon} className="fa-fw" /> {label}
            </Link>
        )
    return (
        <a
            href={entry.href}
            target={entry.external ? "_blank" : undefined}
            rel={entry.external ? "noopener" : undefined}
            title={entry.linkTitle}
        >
            <FontAwesomeIcon icon={entry.icon} className="fa-fw" /> {label}
        </a>
    )
}

export const AdminSidebar = (): React.ReactElement => (
    <aside className="AdminSidebar">
        <ul className="sidebar-menu">
            {ADMIN_NAV_SECTIONS.map((section) => (
                <React.Fragment key={section.label}>
                    <li className="header">{section.label}</li>
                    {section.entries.map((entry) => (
                        <li key={entry.title}>
                            <NavEntryLink entry={entry} />
                            {entry.children && (
                                <ul>
                                    {entry.children.map((child) => (
                                        <li key={child.title}>
                                            <NavEntryLink entry={child} />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </li>
                    ))}
                </React.Fragment>
            ))}
        </ul>
    </aside>
)
