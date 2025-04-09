export const VITE_ASSET_SITE_ENTRY = "site/owid.entry.ts"
export const VITE_ASSET_ADMIN_ENTRY = "adminSiteClient/admin.entry.ts"

export enum ViteEntryPoint {
    Site = "site",
    Archive = "archive",
    Admin = "admin",
}

export const VITE_ENTRYPOINT_INFO = {
    [ViteEntryPoint.Site]: {
        entryPointFile: VITE_ASSET_SITE_ENTRY,
        outDir: "assets",
        outName: "owid",
    },
    [ViteEntryPoint.Archive]: {
        entryPointFile: VITE_ASSET_SITE_ENTRY,
        outDir: "assets-archive",
        outName: "owid",
    },
    [ViteEntryPoint.Admin]: {
        entryPointFile: VITE_ASSET_ADMIN_ENTRY,
        outDir: "assets-admin",
        outName: "admin",
    },
}
