/**
 * This file is a hack to enable type-safe imports of the default exports
 * of these packages.
 * The reason being that Node doesn't handle CommonJS default exports that
 * are given using `exports.default = abc` very well - the Node import will
 * be `{default: abc}` in that case (using a default import like
 * `import abc from module`).
 * On the other hand, TypeScript expects Node _not_ to do that, and without
 * some trickery it's not possible to make both of them happy.
 *
 * In addition, not only Node but also Webpack consumes these exports, and
 * we can even end up in a situation where Webpack is using the ESM version
 * of the package and Node is using the CJS version.
 *
 * For these reasons, all packages contained in this file should _only_ be
 * imported from here; otherwise things will break in weird ways.
 *
 * **When can we get rid of this hack?**
 * We can remove a package from this file once it is publishing an ESM version,
 * and it is advertised in the package's `package.json` using the
 * [exports](https://nodejs.org/api/packages.html#exports) field.
 *
 * -- @marcelgerber, 2022-03-15
 */

export function getModuleDefault<T>(module: T): T {
    return ((module as any).default as T) ?? module
}

import _AnimateHeight from "react-animate-height"
import _ReactSelect from "react-select"
import _TippyReact from "@tippyjs/react"

export const AnimateHeight = getModuleDefault(_AnimateHeight)
export const ReactSelect = getModuleDefault(_ReactSelect)
export const TippyReact = getModuleDefault(_TippyReact)
