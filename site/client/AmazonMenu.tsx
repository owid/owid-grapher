// This is a port of a jQuery library:
// https://github.com/kamens/jQuery-menu-aim

import * as React from 'react'
import { bind } from 'decko'

import { getParent } from './utils'

interface Position {
    x: number,
    y: number
}

const ATTRIBUTE = "data-submenu-id"
const MOUSE_LOCS_TRACKED = 3
const DELAY = 400
const TOLERANCE_PX = 20

function getSubmenuId(targetEl: HTMLElement): string | null {
    const listItem = getParent(targetEl, (el: HTMLElement) => el.matches(`[${ATTRIBUTE}]`))
    if (listItem) {
        return listItem.getAttribute(ATTRIBUTE)
    }
    return null
}

function slope(a: Position, b: Position) {
    return (b.y - a.y) / (b.x - a.x)
}

export class AmazonMenu extends React.Component<{ children: React.ReactNode, submenuRect?: DOMRect | ClientRect | null, onActivate?: (submenuId: any) => void, onDeactivate?: (submenuId: any) => void }> {
    container: React.RefObject<HTMLDivElement> = React.createRef()
    activeSubmenuId?: string
    mouseLocs: Position[] = []
    lastDelayLoc?: Position
    timeoutId?: number

    @bind onMouseMove(event: React.MouseEvent<HTMLDivElement>) {
        this.mouseLocs.push({
            x: event.pageX,
            y: event.pageY
        })
        if (this.mouseLocs.length > MOUSE_LOCS_TRACKED) this.mouseLocs.shift()
    }

    @bind onMouseLeaveMenu() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId)
        }
    }

    @bind onMouseEnterItem(submenuId: any) {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId)
        }
        this.possiblyActivate(submenuId)
    }

    @bind onClickItem(submenuId: any) {
        this.activate(submenuId)
    }

    possiblyActivate(submenuId: any) {
        const delay = this.activationDelay()

        if (delay) {
            this.timeoutId = window.setTimeout(() => {
                this.possiblyActivate(submenuId)
            }, delay)
        } else {
            this.activate(submenuId)
        }
    }

    activate(submenuId: any) {
        if (submenuId === this.activeSubmenuId) {
            return
        }
        if (this.activeSubmenuId) {
            this.deactivate(this.activeSubmenuId)
        }
        if (this.props.onActivate) this.props.onActivate(submenuId)
        this.activeSubmenuId = submenuId
    }

    deactivate(submenuId: any) {
        if (this.props.onDeactivate) this.props.onDeactivate(submenuId)
        this.activeSubmenuId = undefined
    }

    activationDelay() {
        const { submenuRect } = this.props
        if (!submenuRect) {
            // If there is no other submenu row already active, then
            // go ahead and activate immediately.
            return 0
        }

        const upperLeft = {
            x: submenuRect.left,
            y: submenuRect.top - TOLERANCE_PX
        }
        const upperRight = {
            x: submenuRect.right,
            y: upperLeft.y
        }
        const lowerLeft = {
            x: submenuRect.left,
            y: submenuRect.bottom + TOLERANCE_PX
        }
        const lowerRight = {
            x: submenuRect.right,
            y: lowerLeft.y
        }
        const loc = this.mouseLocs[this.mouseLocs.length - 1]
        let prevLoc = this.mouseLocs[0]

        if (!loc) {
            return 0
        }

        if (!prevLoc) {
            prevLoc = loc
        }

        // if (prevLoc.x < submenuRect.left || prevLoc.x > lowerRight.x || prevLoc.y < submenuRect.top || prevLoc.y > lowerRight.y) {
        //     // If the previous mouse location was outside of the entire
        //     // menu's bounds, immediately activate.
        //     return 0
        // }

        if (this.lastDelayLoc && loc.x === this.lastDelayLoc.x && loc.y === this.lastDelayLoc.y) {
            // If the mouse hasn't moved since the last time we checked
            // for activation status, immediately activate.
            return 0
        }

        // Detect if the user is moving towards the currently activated
        // submenu.
        //
        // If the mouse is heading relatively clearly towards
        // the submenu's content, we should wait and give the user more
        // time before activating a new row. If the mouse is heading
        // elsewhere, we can immediately activate a new row.
        //
        // We detect this by calculating the slope formed between the
        // current mouse location and the upper/lower right points of
        // the menu. We do the same for the previous mouse location.
        // If the current mouse location's slopes are
        // increasing/decreasing appropriately compared to the
        // previous's, we know the user is moving toward the submenu.
        //
        // Note that since the y-axis increases as the cursor moves
        // down the screen, we are looking for the slope between the
        // cursor and the upper right corner to decrease over time, not
        // increase (somewhat counterintuitively).

        const decreasingCorner = upperLeft
        const increasingCorner = lowerLeft

        const decreasingSlope = slope(loc, decreasingCorner)
        const increasingSlope = slope(loc, increasingCorner)
        const prevDecreasingSlope = slope(prevLoc, decreasingCorner)
        const prevIncreasingSlope = slope(prevLoc, increasingCorner)

        if (decreasingSlope < prevDecreasingSlope && increasingSlope > prevIncreasingSlope) {
            // Mouse is moving from previous location towards the
            // currently activated submenu. Delay before activating a
            // new menu row, because user may be moving into submenu.
            this.lastDelayLoc = loc
            return DELAY
        }

        this.lastDelayLoc = undefined
        return 0
    }

    @bind onMouseOver(event: React.MouseEvent<HTMLDivElement>) {
        const submenuId = getSubmenuId(event.target as HTMLElement)
        if (submenuId) {
            this.onMouseEnterItem(submenuId)
        }
    }

    @bind onClick(event: React.MouseEvent<HTMLDivElement>) {
        const submenuId = getSubmenuId(event.target as HTMLElement)
        if (submenuId) {
            this.onClickItem(submenuId)
        }
    }

    render() {
        return (
            <div
                ref={this.container}
                className="amazon-menu-container"
                onMouseMove={this.onMouseMove}
                onMouseLeave={this.onMouseLeaveMenu}
                onMouseOver={this.onMouseOver}
                onClick={this.onClick}
            >
                {this.props.children}
            </div>
        )
    }
}