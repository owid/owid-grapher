// This file allows TypeScript to handle imports of non-code files.
// We need this because the Cloudflare Workers environment imports .wasm modules
// and .bin files (for fonts) directly, which TypeScript doesn't understand by default.

declare module "*.wasm" {
    const content: any
    export default content
}

declare module "*.bin" {
    const content: any
    export default content
}
