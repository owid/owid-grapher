import {
    CreateTombstoneData,
    getOwidGdocFromJSON,
    OwidGdoc,
    OwidGdocIndexItem,
    OwidGdocJSON,
} from "@ourworldindata/utils"
import { Admin } from "./Admin.js"

export async function fetchGdocs(admin: Admin): Promise<OwidGdocIndexItem[]> {
    return admin.getJSONInBackground<OwidGdocIndexItem[]>("/api/gdocs")
}

export async function createGdoc(admin: Admin, id: string): Promise<void> {
    await admin.requestJSON(`/api/gdocs/${id}`, {}, "PUT")
}

export async function updateGdoc(
    admin: Admin,
    gdoc: OwidGdoc
): Promise<OwidGdoc> {
    return admin
        .requestJSON<OwidGdocJSON>(`/api/gdocs/${gdoc.id}`, gdoc, "PUT")
        .then(getOwidGdocFromJSON)
}

export async function deleteGdoc(
    admin: Admin,
    gdocId: string,
    tombstone?: CreateTombstoneData
): Promise<void> {
    await admin.requestJSON(
        `/api/gdocs/${gdocId}`,
        tombstone ? { tombstone } : {},
        "DELETE"
    )
}

export async function updateGdocTags(
    admin: Admin,
    gdocId: string,
    tagIds: number[]
): Promise<void> {
    await admin.requestJSON<{ success: boolean }>(
        `/api/gdocs/${gdocId}/setTags`,
        { tagIds },
        "POST"
    )
}
