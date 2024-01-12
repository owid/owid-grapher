// This is the JSON we get from Google's API before remapping the keys to be consistent with the rest of our interfaces
export interface GDriveImageMetadata {
    name: string // -> filename
    modifiedTime: string // -> updatedAt e.g. "2023-01-11T19:45:27.000Z"
    id: string // -> googleId e.g. "1dfArzg3JrAJupVl4YyJpb2FOnBn4irPX"
    description?: string // -> defaultAlt
    imageMediaMetadata?: {
        width?: number // -> originalWidth
    }
}

export interface ImageMetadata {
    googleId: string
    filename: string
    defaultAlt: string
    // MySQL Date objects round to the nearest second, whereas Google includes milliseconds
    // so we store as an epoch to avoid any conversion issues
    updatedAt: number
    originalWidth?: number
}
