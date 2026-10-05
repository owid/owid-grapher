import type { BespokeComponentDataUrls } from "owid-bespoke-types"

/**
 * TEMPORARY: read the data from the sample files in `public/sample-data/`
 * instead of the ETL export step the registry points to, which doesn't exist
 * yet. The files are built by `scripts/build_sample_data.py`. Turn this off
 * (and delete `public/sample-data/`) once the ETL step publishes the data.
 */
export const USE_SAMPLE_DATA = true

/**
 * Vite serves `public/` next to the bundle, so the sample files sit under
 * the bundle's own folder: `<base>/conflict-deaths/sample-data/`. In
 * development the module is served from `src/`, so the folder is found by
 * name rather than relative to this file.
 */
export function getSampleDataUrls(): BespokeComponentDataUrls {
    const bundleUrl = new URL(import.meta.url)
    const folder = "/conflict-deaths/"
    const index = bundleUrl.pathname.lastIndexOf(folder)
    const basePath =
        index >= 0 ? bundleUrl.pathname.slice(0, index + folder.length) : "/"
    const dataUrl = `${bundleUrl.origin}${basePath}sample-data`
    return {
        dataUrl,
        metadataUrl: `${dataUrl}/conflict-deaths.metadata.json`,
    }
}
