import {
    defaultKeybindingsHandlerIgnore,
    tinykeys,
    type KeybindingOptions,
    type KeybindingTarget,
    type KeybindingsMap,
} from "tinykeys"

const EDITABLE_ELEMENT_SELECTOR = "[contenteditable],input,select,textarea"

/** Returns the focused element, including on contained inside a Shadow DOM */
function getDeepActiveElement(): Element | null {
    let active = document.activeElement
    while (active?.shadowRoot?.activeElement)
        active = active.shadowRoot.activeElement
    return active
}

/**
 * Decides whether a keyboard shortcut should ignore a keyboard event.
 *
 * Extends tinykeys' default (key repeats, IME composition and key presses in
 * editable elements, unless the shortcut is bound to that element) by also
 * ignoring:
 * - Untrusted (script-dispatched) events. react-aria's Autocomplete
 *   re-dispatches keydowns from its search input on the virtually focused
 *   option, so a letter typed into a dropdown search would otherwise trigger
 *   a shortcut instead of being typed.
 * - Events while an editable element has focus, even if the event target is
 *   a different element (e.g. a shadow host).
 */
function shouldIgnoreKeyboardShortcut(event: KeyboardEvent): boolean {
    if (!event.isTrusted) return true
    if (defaultKeybindingsHandlerIgnore(event)) return true
    return !!getDeepActiveElement()?.matches(EDITABLE_ELEMENT_SELECTOR)
}

/**
 * Registers keyboard shortcuts on the given target (usually `window`) and
 * returns a function that unregisters them.
 *
 * Shortcuts don't fire while the user is typing into a form field or
 * editable element. Pass `ignore` in the options to override that.
 */
export function registerKeyboardShortcuts(
    target: KeybindingTarget,
    shortcuts: KeybindingsMap,
    options: KeybindingOptions = {}
): () => void {
    return tinykeys(target, shortcuts, {
        ignore: shouldIgnoreKeyboardShortcut,
        ...options,
    })
}
