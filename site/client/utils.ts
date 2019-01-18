export function getParent(el: HTMLElement, condition: (el: HTMLElement) => boolean): HTMLElement | null {
    let current: HTMLElement | null = el
    while (current) {
        if (condition(current)) return current
        current = current.parentElement
    }
    return null
}
