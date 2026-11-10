import { describe, expect, it } from "vitest"

import {
    fitsAsToggleButtons,
    TOGGLE_BUTTONS_FIT_SLACK,
} from "./toggleButtonsFit.js"

// Switching between toggle buttons and the dropdown can change the available
// width by a scrollbar's width. The decision needs to be stable against
// that, or the control flips back and forth.
describe(fitsAsToggleButtons, () => {
    const requiredWidth = 300

    it("keeps what is showing until both widths are measured", () => {
        for (const showsToggleButtons of [true, false]) {
            expect(
                fitsAsToggleButtons({
                    showsToggleButtons,
                    requiredWidth: undefined,
                    availableWidth: 500,
                })
            ).toBe(showsToggleButtons)
            expect(
                fitsAsToggleButtons({
                    showsToggleButtons,
                    requiredWidth,
                    availableWidth: undefined,
                })
            ).toBe(showsToggleButtons)
        }
    })

    it("keeps showing toggle buttons for as long as they fit exactly", () => {
        const fits = (availableWidth: number): boolean =>
            fitsAsToggleButtons({
                showsToggleButtons: true,
                requiredWidth,
                availableWidth,
            })
        expect(fits(requiredWidth)).toBe(true)
        expect(fits(requiredWidth - 1)).toBe(false)
    })

    it("only goes back to toggle buttons once they fit with slack", () => {
        const fits = (availableWidth: number): boolean =>
            fitsAsToggleButtons({
                showsToggleButtons: false,
                requiredWidth,
                availableWidth,
            })
        expect(fits(requiredWidth)).toBe(false)
        expect(fits(requiredWidth + TOGGLE_BUTTONS_FIT_SLACK - 1)).toBe(false)
        expect(fits(requiredWidth + TOGGLE_BUTTONS_FIT_SLACK)).toBe(true)
    })

    it("settles when a scrollbar comes and goes with the control", () => {
        // The toggle buttons fit only without the scrollbar that showing
        // them brings up.
        const scrollbarWidth = 15
        const widthWithoutScrollbar = requiredWidth + 5
        const widthWithScrollbar = widthWithoutScrollbar - scrollbarWidth

        let showsToggleButtons = true
        const shown: boolean[] = []
        for (let i = 0; i < 4; i++) {
            showsToggleButtons = fitsAsToggleButtons({
                showsToggleButtons,
                requiredWidth,
                availableWidth: showsToggleButtons
                    ? widthWithScrollbar
                    : widthWithoutScrollbar,
            })
            shown.push(showsToggleButtons)
        }
        expect(shown).toEqual([false, false, false, false])
    })
})
