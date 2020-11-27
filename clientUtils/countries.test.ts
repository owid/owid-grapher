#! /usr/bin/env yarn jest

import { getCountryDetectionRedirects } from "utils/countries"

it("generates correct country redirect urls for netlify", () => {
    expect(getCountryDetectionRedirects()).toContain(
        `/detect-country-redirect /detect-country.js?GBR 302! Country=gb`
    )
})
