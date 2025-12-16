#! /usr/bin/env node

import parseArgs from "minimist"
import fs from "fs-extra"
import path from "path"
import * as utils from "./utils.js"
import * as _ from "lodash-es"
import * as Diff from "diff"

const LIVE_GRAPHER_URL = "https://ourworldindata.org/grapher"

const LOCAL_URL = "http://localhost:3030"
const LOCAL_GRAPHER_URL = LOCAL_URL + "/grapher"

const REFERENCES_DIR_NAME = "references"
const DIFFERENCES_DIR_NAME = "differences"
const HTML_OUTPUT_FILENAME = "differences.html"

async function main(args: parseArgs.ParsedArgs) {
    // prepare and check arguments
    const workingDir: string = args["d"] ?? "../owid-grapher-svgs/graphers"
    const compareUrl: string = args["compare-url"] ?? LOCAL_URL

    const compareGrapherUrl = compareUrl + "/grapher"

    if (!fs.existsSync(workingDir))
        throw `Working directory does not exist ${workingDir}`

    const referencesDir = path.join(workingDir, REFERENCES_DIR_NAME)
    const differencesDir = path.join(workingDir, DIFFERENCES_DIR_NAME)
    const outFile = path.join(workingDir, HTML_OUTPUT_FILENAME)

    // collect svg files with differences
    const dir = await fs.opendir(differencesDir)
    const svgFilesWithDifferences = []
    for await (const entry of dir) {
        if (entry.isFile() && entry.name.endsWith("svg")) {
            svgFilesWithDifferences.push(entry.name)
        }
    }

    // get reference records for each svg with differences
    const referenceData = await utils.parseReferenceCsv(referencesDir)
    const referenceDataByFilename = new Map(
        referenceData.map((record) => [record.svgFilename, record])
    )
    const svgRecords = _.sortBy(
        svgFilesWithDifferences.map(
            (filename) => referenceDataByFilename.get(filename)!
        ),
        "viewId"
    )

    // prepare HTML report
    const sections = svgRecords.map((record) =>
        createComparisonView(
            record,
            referencesDir,
            differencesDir,
            compareGrapherUrl
        )
    )
    const summary = `<p class="summary">Number of differences: ${sections.length}</p>`
    const content = summary + sections.join("\n")
    await fs.writeFile(outFile, createHtml(content))
}

const parsedArgs = parseArgs(process.argv.slice(2))
if (parsedArgs["h"] || parsedArgs["help"]) {
    console.log(`create-compare-views.js - utility to create a simple HTML view from a folder of svgs that have differences vs the reference ones

Usage:
    create-compare-views.js [-d] [-u | --compare-url]

Inputs and outputs:
    -d DIR   Directory [default: ../owid-grapher-svgs/graphers]

Options:
    --compare-url   Base URL to compare against prod [default: ${LOCAL_URL}]
    `)
} else {
    void main(parsedArgs)
}

function escapeQuestionMark(str: string) {
    return str.replace(/\?/g, "%3F")
}

function createTabControls() {
    return `<div class="tabs">
        <button class="tab-btn active" data-tab="side-by-side">Side by Side</button>
        <button class="tab-btn" data-tab="slider">Swipe</button>
        <button class="tab-btn" data-tab="code-diff">Code Diff</button>
    </div>`
}

function createSideBySideView(
    svgRecord: utils.SvgRecord,
    referenceFilename: string,
    differencesFilename: string,
    compareGrapherUrl: string
) {
    const { slug } = svgRecord
    const queryStr = svgRecord.queryStr ? `?${svgRecord.queryStr}` : ""

    return `<div class="tab-pane active" data-pane="side-by-side">
        <div class="side-by-side">
            <div class="comparison-item deleted">
                <div class="comparison-header">Deleted</div>
                <a href="${LIVE_GRAPHER_URL}/${slug}${queryStr}" target="_blank" class="comparison-image-wrapper">
                    <img src="${escapeQuestionMark(referenceFilename)}" loading="lazy" alt="Reference (live)">
                </a>
            </div>
            <div class="comparison-item added">
                <div class="comparison-header">Added</div>
                <a href="${compareGrapherUrl}/${slug}${queryStr}" target="_blank" class="comparison-image-wrapper">
                    <img src="${escapeQuestionMark(differencesFilename)}" loading="lazy" alt="Current (local)">
                </a>
            </div>
        </div>
    </div>`
}

function createSliderView(
    referenceFilename: string,
    differencesFilename: string
) {
    return `<div class="tab-pane" data-pane="slider">
        <div class="slider-wrapper">
            <img-comparison-slider class="comparison-slider">
                <img slot="first" src="${escapeQuestionMark(referenceFilename)}" loading="lazy" alt="Reference (live)" />
                <img slot="second" src="${escapeQuestionMark(differencesFilename)}" loading="lazy" alt="Current (local)" />
            </img-comparison-slider>
        </div>
    </div>`
}

function createCodeDiffView(
    referenceFilename: string,
    differencesFilename: string,
    svgFilename: string
) {
    // Read both SVG files
    const referenceContent = fs.readFileSync(referenceFilename, "utf-8")
    const differencesContent = fs.readFileSync(differencesFilename, "utf-8")

    // Generate unified diff with just the filename as the title
    const unifiedDiff = Diff.createTwoFilesPatch(
        svgFilename,
        svgFilename,
        referenceContent,
        differencesContent,
        "",
        ""
    )

    // Truncate large diffs to avoid bloating HTML file
    const MAX_DIFF_LINES = 500
    const diffLines = unifiedDiff.split("\n")
    const isTruncated = diffLines.length > MAX_DIFF_LINES
    const truncatedDiff = isTruncated
        ? diffLines.slice(0, MAX_DIFF_LINES).join("\n") +
          `\n\n... (diff truncated: showing ${MAX_DIFF_LINES} of ${diffLines.length} lines)`
        : unifiedDiff

    // Escape the diff for embedding in HTML (escape backticks and backslashes for template literal)
    const escapedDiff = truncatedDiff
        .replace(/\\/g, "\\\\")
        .replace(/`/g, "\\`")
        .replace(/\$/g, "\\$")

    return `<div class="tab-pane" data-pane="code-diff">
        <div class="code-diff-container" data-diff="${escapedDiff.replace(/"/g, "&quot;")}" data-truncated="${isTruncated}"></div>
    </div>`
}

function createComparisonView(
    svgRecord: utils.SvgRecord,
    referencesDir: string,
    differencesDir: string,
    compareGrapherUrl = LOCAL_GRAPHER_URL
) {
    const { svgFilename, slug } = svgRecord

    const referenceFilenameUrl = path.join(REFERENCES_DIR_NAME, svgFilename)
    const differenceFilenameUrl = path.join(DIFFERENCES_DIR_NAME, svgFilename)

    const referencesPath = path.join(referencesDir, svgFilename)
    const differencesPath = path.join(differencesDir, svgFilename)

    const queryStr = svgRecord.queryStr ? `?${svgRecord.queryStr}` : ""

    return `<section data-slug="${slug}">
        <div class="header-with-actions">
            <h2>${slug}${queryStr}</h2>
            <button class="copy-slug-btn" data-slug="${slug}" title="Copy slug to clipboard">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10.5 2h-8A1.5 1.5 0 001 3.5v8A1.5 1.5 0 002.5 13h8a1.5 1.5 0 001.5-1.5v-8A1.5 1.5 0 0010.5 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M5 2V1.5A1.5 1.5 0 016.5 0h8A1.5 1.5 0 0116 1.5v8A1.5 1.5 0 0114.5 11H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span class="copy-text">Copy slug</span>
            </button>
        </div>
        ${createTabControls()}
        <div class="tab-content">
            ${createSideBySideView(svgRecord, referenceFilenameUrl, differenceFilenameUrl, compareGrapherUrl)}
            ${createSliderView(referenceFilenameUrl, differenceFilenameUrl)}
            ${createCodeDiffView(referencesPath, differencesPath, svgFilename)}
        </div>
    </section>`
}

function createHtml(content: string) {
    return `<!doctype html>

<html lang="en">

<head>
    <meta charset="utf-8">
    <title>Comparison</title>
    <link rel="stylesheet" href="https://unpkg.com/img-comparison-slider@8/dist/styles.css">
    <link rel="stylesheet" href="https://unpkg.com/diff2html/bundles/css/diff2html.min.css">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f6f8fa;
        }

        .summary {
            text-align: center;
            font-size: 1rem;
            margin-bottom: 30px;
            padding: 12px;
            background: white;
            border: 1px solid #d0d7de;
            border-radius: 6px;
            color: #24292e;
        }

        section {
            background: white;
            border: 1px solid #d0d7de;
            border-radius: 6px;
            padding: 24px;
            margin-bottom: 24px;
        }

        section + section {
            margin-top: 0;
        }

        h2 {
            font-size: 1.2rem;
            margin: 0;
        }

        .header-with-actions {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            margin-bottom: 20px;
        }

        .copy-slug-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border: 1px solid #d1d5da;
            background: #fafbfc;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.85rem;
            color: #24292e;
            transition: all 0.15s;
            text-decoration: none;
            font-weight: 500;
        }

        .copy-slug-btn:hover {
            background: #f3f4f6;
            border-color: #a0a8b0;
        }

        .copy-slug-btn.copied {
            background: #dafbe1;
            border-color: #4ac26b;
            color: #1a7f37;
        }

        .copy-slug-btn svg {
            flex-shrink: 0;
        }

        /* Tabs */
        .tabs {
            display: flex;
            gap: 4px;
            margin-bottom: 20px;
            justify-content: center;
        }

        .tab-btn {
            padding: 8px 16px;
            border: 1px solid #d1d5da;
            background: #fafbfc;
            cursor: pointer;
            font-size: 0.9rem;
            color: #24292e;
            transition: all 0.1s;
            font-weight: 500;
        }

        .tab-btn:first-child {
            border-radius: 6px 0 0 6px;
        }

        .tab-btn:last-child {
            border-radius: 0 6px 6px 0;
        }

        .tab-btn:hover {
            background: #f3f4f6;
        }

        .tab-btn.active {
            background: white;
            border-color: #0969da;
            color: #0969da;
            z-index: 1;
        }

        /* Tab content */
        .tab-content {
            min-height: 400px;
        }

        .tab-pane {
            display: none;
        }

        .tab-pane.active {
            display: block;
        }

        /* Side by side view */
        .side-by-side {
            display: flex;
            gap: 10px;
            justify-content: center;
        }

        .comparison-item {
            flex: 1;
            display: flex;
            flex-direction: column;
            max-width: 600px;
        }

        .comparison-header {
            font-weight: 600;
            font-size: 0.9rem;
            padding: 8px 12px;
            text-align: center;
            border: 1px solid;
            border-bottom: none;
            border-radius: 6px 6px 0 0;
        }

        .comparison-item.deleted .comparison-header {
            background: #ffebe9;
            color: #cf222e;
            border-color: #ff818266;
        }

        .comparison-item.added .comparison-header {
            background: #dafbe1;
            color: #1a7f37;
            border-color: #4ac26b66;
        }

        .comparison-image-wrapper {
            display: block;
            border: 1px solid;
            overflow: hidden;
        }

        .comparison-item.deleted .comparison-image-wrapper {
            border-color: #ff818266;
        }

        .comparison-item.added .comparison-image-wrapper {
            border-color: #4ac26b66;
        }

        .comparison-image-wrapper img {
            display: block;
            width: 100%;
            max-width: 100%;
        }

        /* Slider view */
        .slider-wrapper {
            position: relative;
            text-align: center;
        }

        .comparison-slider {
            width: 800px;
            max-width: 100%;
            margin: 0 auto;
            display: inline-block;
            overflow: hidden;
            --divider-width: 1px;
            --divider-color: #333;
            --default-handle-opacity: 0;
            cursor: ew-resize;
        }

        img-comparison-slider img {
            max-width: 100%;
            width: 100%;
            display: block;
            border-radius: 4px;
        }

        /* Red outline for old/reference version (first image) */
        img-comparison-slider img[slot="first"] {
            outline: 1px solid #d32f2f;
            outline-offset: -1px;
        }

        /* Green outline for new/current version (second image) */
        img-comparison-slider img[slot="second"] {
            outline: 1px solid #388e3c;
            outline-offset: -1px;
        }

        /* Remove focus ring when dragging */
        img-comparison-slider:focus {
            outline: none;
        }

        img-comparison-slider:focus-visible {
            outline: none;
        }

        /* Labels for slider */
        .slider-labels {
            display: flex;
            justify-content: space-between;
            margin-top: 12px;
            font-size: 0.85rem;
            font-weight: 600;
        }

        .slider-label-left {
            color: #cf222e;
        }

        .slider-label-right {
            color: #1a7f37;
        }

        /* Code diff view */
        .code-diff-container {
            max-height: 800px;
            overflow: auto;
            border: 1px solid #d0d7de;
            border-radius: 6px;
        }

        /* Override diff2html styles for better integration */
        .code-diff-container .d2h-wrapper {
            border: none;
        }

        .code-diff-container .d2h-file-header {
            border-radius: 0;
        }

        /* Hide the "Viewed" checkbox */
        .code-diff-container .d2h-file-collapse {
            display: none !important;
        }

        /* Fix line number overflow on scroll */
        .code-diff-container .d2h-file-diff {
            overflow-x: auto;
        }

        .code-diff-container .d2h-code-side-linenumber {
            position: sticky;
            left: 0;
            background: inherit;
            z-index: 0;
        }

        .code-diff-container .d2h-code-linenumber {
            min-width: 50px;
        }
    </style>
</head>

<body>
    ${content}
    <script type="module" src="https://unpkg.com/img-comparison-slider@8/dist/index.js"></script>
    <script src="https://unpkg.com/diff2html/bundles/js/diff2html-ui.min.js"></script>
    <script>
        // Track which diffs have been rendered
        const renderedDiffs = new Set();

        // Tab switching functionality
        document.addEventListener('click', (e) => {
            const tabBtn = e.target.closest('.tab-btn');
            if (tabBtn) {
                const section = tabBtn.closest('section');
                const targetTab = tabBtn.dataset.tab;

                // Update button states
                section.querySelectorAll('.tab-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.tab === targetTab);
                });

                // Update pane visibility
                section.querySelectorAll('.tab-pane').forEach(pane => {
                    pane.classList.toggle('active', pane.dataset.pane === targetTab);
                });

                // Render code diff if switching to code-diff tab
                if (targetTab === 'code-diff') {
                    const diffContainer = section.querySelector('.code-diff-container');
                    const slug = section.dataset.slug;
                    const diffId = slug;

                    // Only render once per section
                    if (diffContainer && !renderedDiffs.has(diffId)) {
                        const diffString = diffContainer.dataset.diff;
                        const isTruncated = diffContainer.dataset.truncated === 'true';

                        // Add truncation warning if needed
                        if (isTruncated) {
                            const warning = document.createElement('div');
                            warning.style.cssText = 'background: #fff3cd; border: 1px solid #ffc107; color: #856404; padding: 12px; margin-bottom: 12px; border-radius: 6px; text-align: center; font-size: 0.9rem;';
                            warning.innerHTML = '<strong>Note:</strong> This diff is very large and has been truncated';
                            diffContainer.parentElement.insertBefore(warning, diffContainer);
                        }

                        // Create Diff2Html UI instance
                        const diff2htmlUi = new Diff2HtmlUI(diffContainer, diffString, {
                            drawFileList: false,
                            matching: 'lines',
                            outputFormat: 'side-by-side',
                            highlight: true,
                            renderNothingWhenEmpty: false,
                        });

                        diff2htmlUi.draw();
                        renderedDiffs.add(diffId);
                    }
                }

                return;
            }

            // Copy slug functionality
            const copyBtn = e.target.closest('.copy-slug-btn');
            if (copyBtn) {
                const slug = copyBtn.dataset.slug;
                const copyText = copyBtn.querySelector('.copy-text');

                navigator.clipboard.writeText(slug).then(() => {
                    // Visual feedback
                    copyBtn.classList.add('copied');
                    const originalText = copyText.textContent;
                    copyText.textContent = 'Copied!';

                    // Reset after 2 seconds
                    setTimeout(() => {
                        copyBtn.classList.remove('copied');
                        copyText.textContent = originalText;
                    }, 2000);
                }).catch(err => {
                    console.error('Failed to copy:', err);
                    copyText.textContent = 'Failed';
                    setTimeout(() => {
                        copyText.textContent = 'Copy slug';
                    }, 2000);
                });
            }
        });
    </script>
</body>

</html>`
}
