import * as R from "remeda"
import cx from "classnames"
import { useState } from "react"
import {
    Button,
    MenuTrigger,
    Popover,
    Menu,
    MenuItem,
} from "react-aria-components"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faEllipsisVertical } from "@fortawesome/free-solid-svg-icons"
import { TabItem, Tabs } from "./Tabs"

export const TabsWithDropdown = <TabKey extends string = string>({
    items,
    selectedKey,
    onChange,
    numVisibleTabs,
    className,
    portalContainer,
}: {
    items: TabItem<TabKey>[]
    selectedKey: TabKey
    onChange: (key: TabKey) => void
    numVisibleTabs: number
    className?: string
    portalContainer?: HTMLElement
}) => {
    const [isOpen, setIsOpen] = useState(false)

    let visibleItems = R.take(items, numVisibleTabs)
    let hiddenItems = items.filter(
        (item) => !visibleItems.find((v) => v.key === item.key)
    )

    // If a hidden item is selected, swap it with the last visible item
    const selectedHiddenItem = hiddenItems.find(
        (item) => item.key === selectedKey
    )
    if (selectedHiddenItem && visibleItems.length > 0) {
        const lastVisibleItem = visibleItems[visibleItems.length - 1]
        visibleItems = R.pipe(
            visibleItems,
            R.dropLast(1),
            R.concat([selectedHiddenItem])
        )
        hiddenItems = hiddenItems
            .filter((item) => item.key !== selectedKey)
            .concat(lastVisibleItem)
    }

    const handleSelect = (key: React.Key) => {
        if (typeof key === "string") onChange(key as TabKey)
        setIsOpen(false)
    }

    return (
        <div className={cx("TabsWithDropdown", className)}>
            <div className="TabsWithDropdown__Row">
                <Tabs
                    className="TabsWithDropdown__Tabs"
                    items={visibleItems}
                    selectedKey={selectedKey}
                    onChange={onChange}
                    variant="stretch"
                />
                {hiddenItems.length > 0 && (
                    <MenuTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
                        <Button
                            className="TabsWithDropdown__MoreButton"
                            aria-label="Show more tabs"
                            data-open={isOpen || undefined}
                        >
                            <FontAwesomeIcon
                                icon={faEllipsisVertical}
                                aria-hidden="true"
                            />
                            <span>More</span>
                        </Button>
                        <Popover
                            className="TabsWithDropdown__Popover"
                            placement="bottom end"
                            UNSTABLE_portalContainer={portalContainer}
                        >
                            <Menu
                                className="TabsWithDropdown__Menu"
                                onAction={handleSelect}
                            >
                                {hiddenItems.map((item) => (
                                    <MenuItem
                                        key={item.key}
                                        id={item.key}
                                        className={cx(
                                            "TabsWithDropdown__MenuItem",
                                            item.buttonProps?.className
                                        )}
                                        data-track-note={
                                            item.buttonProps?.dataTrackNote
                                        }
                                        aria-label={item.buttonProps?.ariaLabel}
                                        ref={item.buttonProps?.ref}
                                    >
                                        {item.element}
                                    </MenuItem>
                                ))}
                            </Menu>
                        </Popover>
                    </MenuTrigger>
                )}
            </div>
        </div>
    )
}
