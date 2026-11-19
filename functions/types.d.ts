/**
 * Cloudflare workers can import binary files ending in .wasm
 */
declare module "*.wasm" {
    const content: any
    export default content
}
