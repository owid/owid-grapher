/**
 * React and the browser-integrated Google Translate don't love each other:
 * In a translated page, some interactions entirely break the page.
 * Since Google Translate actually works quite well for OWID and we would like to support that use
 * case, we're monkey-patching the global Node.removeChild and Node.insertBefore instead.
 * It's a hack that has been suggested by Dan Abramov himself: https://github.com/facebook/react/issues/11538#issuecomment-417504600
 * -@MarcelGerber, 2021-09-06
 */
export const runMonkeyPatchForGoogleTranslate = (): void => {
    if (typeof Node === "function" && Node.prototype) {
        const originalRemoveChild = Node.prototype.removeChild
        Node.prototype.removeChild = function <T extends Node>(child: T): T {
            if (child.parentNode !== this) {
                if (console) {
                    console.error(
                        "Cannot remove a child from a different parent",
                        child,
                        this
                    )
                }
                return child
            }
            return originalRemoveChild.apply(this, [child]) as T
        }

        const originalInsertBefore = Node.prototype.insertBefore
        Node.prototype.insertBefore = function <T extends Node>(
            newNode: T,
            referenceNode: Node | null
        ) {
            if (referenceNode && referenceNode.parentNode !== this) {
                if (console) {
                    console.error(
                        "Cannot insert before a reference node from a different parent",
                        referenceNode,
                        this
                    )
                }
                return newNode
            }
            return originalInsertBefore.apply(this, [
                newNode,
                referenceNode,
            ]) as T
        }
    }
}
