#! /usr/bin/env yarn jest

import { SiteBaker } from "site/server/SiteBaker"

describe(SiteBaker, () => {
    it("generates correct country redirect urls for netlify", () => {
        expect(SiteBaker.getCountryDetectionRedirects()).toContain(
            `/detect-country-redirect /detect-country.js?GBR 302! Country=gb`
        )
    })
})
