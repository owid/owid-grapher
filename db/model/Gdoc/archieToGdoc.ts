import { docs as googleDocs } from "@googleapis/docs"
import { drive as googleDrive } from "@googleapis/drive"
import { OwidGoogleAuth } from "../../OwidGoogleAuth.js"

export async function createGdocFromTemplate(
    templateId: string,
    title: string,
    targetFolder: string
): Promise<string> {
    const auth = OwidGoogleAuth.getGoogleReadWriteAuth()
    const driveClient = googleDrive({ version: "v3", auth })

    const docsMimeType = "application/vnd.google-apps.document"
    const response = await driveClient.files.copy({
        supportsAllDrives: true,
        fileId: templateId,
        requestBody: {
            name: title,
            parents: [targetFolder],
            mimeType: docsMimeType,
        },
    })

    if (!response.data.id) {
        throw new Error("Failed to copy document with ID " + templateId)
    }

    return response.data.id
}

export async function replacePlaceholdersInGdoc(
    docId: string,
    replacements: Record<string, string>
): Promise<void> {
    const auth = OwidGoogleAuth.getGoogleReadWriteAuth()
    const client = googleDocs({ version: "v1", auth })

    const requests = Object.entries(replacements).map(
        ([placeholder, value]) => ({
            replaceAllText: {
                containsText: {
                    text: `{{${placeholder}}}`, // Match placeholders like {{name}}
                    matchCase: true,
                },
                replaceText: value,
            },
        })
    )

    await client.documents.batchUpdate({
        documentId: docId,
        requestBody: { requests },
    })
}
