Feature: Wikipedia archive

    Charts served from the Wikipedia archive should not make requests
    to Google servers, unlike the production archive. Legacy URLs like
    detect-country.owid.io should be rewritten to ourworldindata.org.

    Scenario: Wikipedia archive chart does not make GTM requests
        Given I open "life-expectancy" from the wikipedia archive
        Then the page should not make requests to "googletagmanager.com"

    Scenario: Wikipedia archive chart does not request detect-country.owid.io
        Given I open "life-expectancy" from the wikipedia archive
        Then the page should not make requests to "detect-country.owid.io"
        And the page should make requests to "/api/detect-country"
