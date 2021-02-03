import { OwidAdminApp } from "./app"

describe(OwidAdminApp, () => {
    const app = new OwidAdminApp({ isDev: true, gitCmsDir: "" })

    it("should be able to create an app", () => {
        expect(app).toBeTruthy()
    })
})
