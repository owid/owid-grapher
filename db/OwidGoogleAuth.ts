import {
    GDOCS_CLIENT_EMAIL,
    GDOCS_CLIENT_ID,
    GDOCS_PRIVATE_KEY,
} from "../settings/serverSettings.js"
import { type docs_v1 } from "@googleapis/docs"
import { GoogleAuth } from "google-auth-library"

export class OwidGoogleAuth {
    static cachedGoogleReadonlyAuth?: GoogleAuth
    static cachedGoogleReadWriteAuth?: GoogleAuth
    static cachedGoogleClient?: docs_v1.Docs

    static areGdocAuthKeysSet(): boolean {
        return !!(GDOCS_PRIVATE_KEY && GDOCS_CLIENT_EMAIL && GDOCS_CLIENT_ID)
    }

    static getGoogleReadWriteAuth(): GoogleAuth {
        if (!OwidGoogleAuth.cachedGoogleReadWriteAuth) {
            OwidGoogleAuth.cachedGoogleReadWriteAuth = new GoogleAuth({
                credentials: {
                    type: "service_account",
                    private_key: GDOCS_PRIVATE_KEY.split("\\n").join("\n"),
                    client_email: GDOCS_CLIENT_EMAIL,
                    client_id: GDOCS_CLIENT_ID,
                },
                scopes: [
                    "https://www.googleapis.com/auth/documents",
                    "https://www.googleapis.com/auth/drive",
                ],
            })
        }
        return OwidGoogleAuth.cachedGoogleReadWriteAuth
    }

    static getGoogleReadonlyAuth(): GoogleAuth {
        if (!OwidGoogleAuth.cachedGoogleReadonlyAuth) {
            OwidGoogleAuth.cachedGoogleReadonlyAuth = new GoogleAuth({
                credentials: {
                    type: "service_account",
                    private_key: GDOCS_PRIVATE_KEY.split("\\n").join("\n"),
                    client_email: GDOCS_CLIENT_EMAIL,
                    client_id: GDOCS_CLIENT_ID,
                },
                // Scopes can be specified either as an array or as a single, space-delimited string.
                scopes: [
                    "https://www.googleapis.com/auth/documents.readonly",
                    "https://www.googleapis.com/auth/drive.readonly",
                ],
            })
        }
        return OwidGoogleAuth.cachedGoogleReadonlyAuth
    }
}
