import {
    GDOCS_CLIENT_EMAIL,
    GDOCS_CLIENT_ID,
    GDOCS_PRIVATE_KEY,
} from "../settings/serverSettings.js"
import { google, Auth, docs_v1 } from "googleapis"

export class OwidGoogleAuth {
    static cachedGoogleReadonlyAuth?: Auth.GoogleAuth
    static cachedGoogleReadWriteAuth?: Auth.GoogleAuth
    static cachedGoogleClient?: docs_v1.Docs

    static areGdocAuthKeysSet(): boolean {
        return !!(GDOCS_PRIVATE_KEY && GDOCS_CLIENT_EMAIL && GDOCS_CLIENT_ID)
    }

    static getGoogleReadWriteAuth(): Auth.GoogleAuth {
        if (!OwidGoogleAuth.cachedGoogleReadWriteAuth) {
            OwidGoogleAuth.cachedGoogleReadWriteAuth =
                new google.auth.GoogleAuth({
                    credentials: {
                        type: "service_account",
                        private_key: GDOCS_PRIVATE_KEY.split("\\n").join("\n"),
                        client_email: GDOCS_CLIENT_EMAIL,
                        client_id: GDOCS_CLIENT_ID,
                    },
                    scopes: [
                        "https://www.googleapis.com/auth/documents",
                        "https://www.googleapis.com/auth/drive.file",
                    ],
                })
        }
        return OwidGoogleAuth.cachedGoogleReadWriteAuth
    }

    static getGoogleReadonlyAuth(): Auth.GoogleAuth {
        if (!OwidGoogleAuth.cachedGoogleReadonlyAuth) {
            OwidGoogleAuth.cachedGoogleReadonlyAuth =
                new google.auth.GoogleAuth({
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
