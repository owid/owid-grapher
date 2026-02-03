// Script injected into preview pages to enable inline commenting
// This is a prototype to demonstrate the UX

export function getPreviewCommentScript(variableId: number): string {
    return `
<style>
/* Comment mode styles */
.owid-comment-toggle {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    background: #002147;
    color: white;
    border: none;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.owid-comment-toggle:hover {
    background: #003366;
}
.owid-comment-toggle.active {
    background: #28a745;
}
.owid-comment-toggle .badge {
    background: #dc3545;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
}

.owid-comment-icon {
    display: none;
    background: #f0f0f0;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 2px 6px;
    cursor: pointer;
    font-size: 11px;
    color: #666;
    margin-left: 8px;
    vertical-align: middle;
}
.owid-comment-icon:hover {
    background: #002147;
    color: white;
    border-color: #002147;
}
.owid-comment-icon.has-comments {
    background: #fff3cd;
    border-color: #ffc107;
    color: #856404;
}
body.comment-mode-active .owid-comment-icon {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.owid-comment-popover {
    position: fixed;
    z-index: 10000;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    width: 340px;
    max-height: 450px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.owid-comment-popover-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 14px;
    background: #f8f9fa;
    border-bottom: 1px solid #e0e0e0;
    border-radius: 8px 8px 0 0;
}
.owid-comment-popover-title {
    font-size: 13px;
    color: #333;
    font-weight: 500;
}
.owid-comment-popover-close {
    background: none;
    border: none;
    cursor: pointer;
    color: #666;
    font-size: 16px;
    padding: 4px 8px;
}
.owid-comment-popover-close:hover {
    color: #333;
}
.owid-comment-popover-list {
    max-height: 200px;
    overflow-y: auto;
    padding: 10px;
}
.owid-comment-popover-item {
    background: #f8f9fa;
    border-radius: 6px;
    padding: 10px 12px;
    margin-bottom: 10px;
    font-size: 13px;
}
.owid-comment-popover-item:last-child {
    margin-bottom: 0;
}
.owid-comment-popover-author {
    font-weight: 600;
    color: #333;
    font-size: 12px;
}
.owid-comment-popover-content {
    color: #333;
    line-height: 1.5;
    margin-top: 4px;
}
.owid-comment-popover-resolve {
    background: none;
    border: none;
    color: #28a745;
    font-size: 11px;
    cursor: pointer;
    padding: 4px 0;
    margin-top: 6px;
}
.owid-comment-popover-resolve:hover {
    text-decoration: underline;
}
.owid-comment-popover-form {
    padding: 12px;
    border-top: 1px solid #e0e0e0;
}
.owid-comment-popover-form textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 13px;
    resize: none;
    font-family: inherit;
    box-sizing: border-box;
}
.owid-comment-popover-form textarea:focus {
    outline: none;
    border-color: #002147;
}
.owid-comment-popover-submit {
    margin-top: 8px;
    background: #002147;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    width: 100%;
}
.owid-comment-popover-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
.owid-comment-popover-submit:hover:not(:disabled) {
    background: #003366;
}
.owid-comment-popover-empty {
    padding: 12px;
    color: #666;
    font-size: 13px;
    text-align: center;
}

/* Highlight commentable fields in comment mode */
body.comment-mode-active .key-data {
    position: relative;
}
body.comment-mode-active .key-data:hover {
    background: rgba(0, 33, 71, 0.05);
    border-radius: 4px;
}
</style>

<script>
(function() {
    const VARIABLE_ID = ${variableId};
    const TARGET_TYPE = 'variable';

    // Field mappings - title text to field path
    const FIELD_MAPPINGS = {
        'Source': { path: 'source', label: 'Source' },
        'Last updated': { path: 'lastUpdated', label: 'Last updated' },
        'Next expected update': { path: 'nextUpdate', label: 'Next expected update' },
        'Date range': { path: 'dateRange', label: 'Date range' },
        'Unit': { path: 'unit', label: 'Unit' },
        'Unit conversion factor': { path: 'unitConversionFactor', label: 'Unit conversion factor' },
        'Links': { path: 'links', label: 'Links' },
    };

    let comments = [];
    let isCommentModeActive = false;
    let currentPopover = null;

    // Fetch comments
    async function fetchComments() {
        try {
            const params = new URLSearchParams({
                targetType: TARGET_TYPE,
                targetId: String(VARIABLE_ID),
                includeResolved: 'false'
            });
            const response = await fetch('/admin/api/comments.json?' + params.toString(), {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                comments = data.comments || [];
                updateCommentCounts();
            }
        } catch (err) {
            console.error('Error fetching comments:', err);
        }
    }

    // Create comment
    async function createComment(fieldPath, content) {
        try {
            const response = await fetch('/admin/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    targetType: TARGET_TYPE,
                    targetId: String(VARIABLE_ID),
                    fieldPath: fieldPath,
                    content: content
                })
            });
            if (response.ok) {
                await fetchComments();
                return true;
            }
        } catch (err) {
            console.error('Error creating comment:', err);
        }
        return false;
    }

    // Resolve comment
    async function resolveComment(id) {
        try {
            const response = await fetch('/admin/api/comments/' + id + '/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: '{}'
            });
            if (response.ok) {
                await fetchComments();
            }
        } catch (err) {
            console.error('Error resolving comment:', err);
        }
    }

    // Update comment counts on icons
    function updateCommentCounts() {
        document.querySelectorAll('.owid-comment-icon').forEach(icon => {
            const fieldPath = icon.dataset.fieldPath;
            const count = comments.filter(c => c.fieldPath === fieldPath).length;
            const badge = icon.querySelector('.badge');
            if (badge) {
                badge.textContent = count;
                badge.style.display = count > 0 ? 'inline' : 'none';
            }
            icon.classList.toggle('has-comments', count > 0);
        });

        // Update toggle button badge
        const toggleBadge = document.querySelector('.owid-comment-toggle .badge');
        if (toggleBadge) {
            toggleBadge.textContent = comments.length;
            toggleBadge.style.display = comments.length > 0 ? 'inline' : 'none';
        }
    }

    // Show popover
    function showPopover(icon, fieldPath, fieldLabel) {
        closePopover();

        const fieldComments = comments.filter(c => c.fieldPath === fieldPath);
        const rect = icon.getBoundingClientRect();

        const popover = document.createElement('div');
        popover.className = 'owid-comment-popover';
        popover.style.top = (rect.bottom + window.scrollY + 8) + 'px';
        popover.style.left = Math.min(rect.left, window.innerWidth - 360) + 'px';

        popover.innerHTML = \`
            <div class="owid-comment-popover-header">
                <span class="owid-comment-popover-title">Comments on: <strong>\${fieldLabel}</strong></span>
                <button class="owid-comment-popover-close">&times;</button>
            </div>
            \${fieldComments.length > 0 ? \`
                <div class="owid-comment-popover-list">
                    \${fieldComments.map(c => \`
                        <div class="owid-comment-popover-item" data-id="\${c.id}">
                            <div class="owid-comment-popover-author">\${c.userFullName}</div>
                            <div class="owid-comment-popover-content">\${c.content}</div>
                            <button class="owid-comment-popover-resolve" data-id="\${c.id}">✓ Resolve</button>
                        </div>
                    \`).join('')}
                </div>
            \` : '<div class="owid-comment-popover-empty">No comments yet</div>'}
            <form class="owid-comment-popover-form">
                <textarea placeholder="Add a comment..." rows="2"></textarea>
                <button type="submit" class="owid-comment-popover-submit">Add Comment</button>
            </form>
        \`;

        document.body.appendChild(popover);
        currentPopover = popover;

        // Event listeners
        popover.querySelector('.owid-comment-popover-close').addEventListener('click', closePopover);

        popover.querySelectorAll('.owid-comment-popover-resolve').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = parseInt(e.target.dataset.id);
                await resolveComment(id);
                showPopover(icon, fieldPath, fieldLabel); // Refresh
            });
        });

        const form = popover.querySelector('.owid-comment-popover-form');
        const textarea = form.querySelector('textarea');
        const submitBtn = form.querySelector('.owid-comment-popover-submit');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const content = textarea.value.trim();
            if (!content) return;

            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';

            const success = await createComment(fieldPath, content);
            if (success) {
                textarea.value = '';
                showPopover(icon, fieldPath, fieldLabel); // Refresh
            }

            submitBtn.disabled = false;
            submitBtn.textContent = 'Add Comment';
        });
    }

    function closePopover() {
        if (currentPopover) {
            currentPopover.remove();
            currentPopover = null;
        }
    }

    // Add comment icons to fields
    function addCommentIcons() {
        // Find all .key-data__title elements and add icons based on their text
        document.querySelectorAll('.key-data__title').forEach(titleEl => {
            const titleText = titleEl.textContent.trim();
            const fieldInfo = FIELD_MAPPINGS[titleText];

            if (!fieldInfo) return;
            if (titleEl.querySelector('.owid-comment-icon')) return; // Already added

            const icon = document.createElement('button');
            icon.className = 'owid-comment-icon';
            icon.dataset.fieldPath = fieldInfo.path;
            icon.dataset.fieldLabel = fieldInfo.label;
            icon.innerHTML = '💬 <span class="badge" style="display:none">0</span>';
            icon.title = 'Comment on: ' + fieldInfo.label;

            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                showPopover(icon, fieldInfo.path, fieldInfo.label);
            });

            titleEl.style.display = 'inline-flex';
            titleEl.style.alignItems = 'center';
            titleEl.style.gap = '8px';
            titleEl.appendChild(icon);
        });

        // Also add icon to the main title
        const mainTitle = document.querySelector('.key-data-description-short__title');
        if (mainTitle && !mainTitle.querySelector('.owid-comment-icon')) {
            const icon = document.createElement('button');
            icon.className = 'owid-comment-icon';
            icon.dataset.fieldPath = 'title';
            icon.dataset.fieldLabel = 'Title';
            icon.innerHTML = '💬 <span class="badge" style="display:none">0</span>';
            icon.title = 'Comment on: Title';

            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                showPopover(icon, 'title', 'Title');
            });

            mainTitle.style.display = 'inline-flex';
            mainTitle.style.alignItems = 'center';
            mainTitle.style.gap = '8px';
            mainTitle.appendChild(icon);
        }

        // Add icon to key description section
        const keyDescription = document.querySelector('.key-info__key-description');
        if (keyDescription && !keyDescription.querySelector('.owid-comment-icon')) {
            const icon = document.createElement('button');
            icon.className = 'owid-comment-icon';
            icon.dataset.fieldPath = 'descriptionKey';
            icon.dataset.fieldLabel = 'Key description';
            icon.innerHTML = '💬 <span class="badge" style="display:none">0</span>';
            icon.title = 'Comment on: Key description';

            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                showPopover(icon, 'descriptionKey', 'Key description');
            });

            // Insert at the beginning of the description
            keyDescription.style.position = 'relative';
            icon.style.position = 'absolute';
            icon.style.top = '0';
            icon.style.right = '0';
            keyDescription.appendChild(icon);
        }

        updateCommentCounts();
    }

    // Toggle comment mode
    function toggleCommentMode() {
        isCommentModeActive = !isCommentModeActive;
        document.body.classList.toggle('comment-mode-active', isCommentModeActive);

        const btn = document.querySelector('.owid-comment-toggle');
        btn.classList.toggle('active', isCommentModeActive);
        btn.querySelector('span:first-child').textContent = isCommentModeActive ? '✓ Comment Mode ON' : '💬 Comment Mode';

        if (!isCommentModeActive) {
            closePopover();
        }
    }

    // Initialize
    function init() {
        // Add toggle button
        const toggle = document.createElement('button');
        toggle.className = 'owid-comment-toggle';
        toggle.innerHTML = '<span>💬 Comment Mode</span> <span class="badge" style="display:none">0</span>';
        toggle.addEventListener('click', toggleCommentMode);
        document.body.appendChild(toggle);

        // Close popover on outside click
        document.addEventListener('click', (e) => {
            if (currentPopover && !currentPopover.contains(e.target) && !e.target.closest('.owid-comment-icon') && !e.target.closest('.owid-other-views-banner')) {
                closePopover();
            }
        });

        // Restore comment mode state from sessionStorage
        const shouldBeActive = sessionStorage.getItem('owidCommentModeActive') === 'true';
        if (shouldBeActive) {
            // Set visual state immediately
            isCommentModeActive = true;
            document.body.classList.add('comment-mode-active');
            toggle.classList.add('active');
            toggle.querySelector('span:first-child').textContent = '✓ Comment Mode ON';

            // Use MutationObserver to add icons when DOM elements become available
            waitForElementsAndAddIcons();
        }

        fetchComments();
    }

    let iconsAdded = false;

    // Watch for key DOM elements to appear and add icons when ready
    function waitForElementsAndAddIcons() {
        // Check if elements are already available
        const hasElements = document.querySelector('.key-data__title') || document.querySelector('.HeaderHTML');
        if (hasElements) {
            addCommentIcons();
            iconsAdded = document.querySelectorAll('.owid-comment-icon').length > 0;
            return;
        }

        // Otherwise, watch for them to appear
        const observer = new MutationObserver((mutations, obs) => {
            const hasElements = document.querySelector('.key-data__title') || document.querySelector('.HeaderHTML');
            if (hasElements) {
                obs.disconnect();
                addCommentIcons();
                iconsAdded = document.querySelectorAll('.owid-comment-icon').length > 0;
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    function toggleCommentMode() {
        isCommentModeActive = !isCommentModeActive;
        // Persist state to sessionStorage so it survives page navigation
        sessionStorage.setItem('owidCommentModeActive', isCommentModeActive ? 'true' : 'false');
        document.body.classList.toggle('comment-mode-active', isCommentModeActive);

        const btn = document.querySelector('.owid-comment-toggle');
        btn.classList.toggle('active', isCommentModeActive);
        btn.querySelector('span:first-child').textContent = isCommentModeActive ? '✓ Comment Mode ON' : '💬 Comment Mode';

        if (isCommentModeActive && !iconsAdded) {
            addCommentIcons();
            iconsAdded = document.querySelectorAll('.owid-comment-icon').length > 0;
            // If icons weren't added yet (elements not ready), watch for them
            if (!iconsAdded) {
                waitForElementsAndAddIcons();
            }
        }

        if (!isCommentModeActive) {
            closePopover();
        }
    }

    // Wait for page to fully load (including React hydration)
    if (document.readyState === 'complete') {
        init();
    } else {
        window.addEventListener('load', init);
    }
})();
</script>
`
}

// Multidim version - captures view state from URL params
// Enhanced with view-specific vs all-views commenting
export function getMultidimCommentScript(
    slug: string,
    dimensionSlugs: string[]
): string {
    return `
<style>
/* Comment mode styles - same as variable version */
.owid-comment-toggle {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    background: #002147;
    color: white;
    border: none;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.owid-comment-toggle:hover { background: #003366; }
.owid-comment-toggle.active { background: #28a745; }
.owid-comment-toggle .badge {
    background: #dc3545;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
}
.owid-comment-toggle .badge-other {
    background: #6c757d;
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 11px;
    margin-left: -4px;
}
.owid-other-views-banner {
    position: fixed;
    bottom: 70px;
    right: 20px;
    z-index: 9998;
    background: #fff3cd;
    color: #856404;
    border: 1px solid #ffc107;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    max-width: 280px;
    cursor: pointer;
}
.owid-other-views-banner:hover {
    background: #ffe69c;
}
.owid-other-views-banner strong {
    display: block;
    margin-bottom: 4px;
}
.owid-comment-icon {
    display: none;
    background: #f0f0f0;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 2px 6px;
    cursor: pointer;
    font-size: 11px;
    color: #666;
    margin-left: 8px;
    vertical-align: middle;
}
.owid-comment-icon:hover {
    background: #002147;
    color: white;
    border-color: #002147;
}
.owid-comment-icon.has-comments {
    background: #fff3cd;
    border-color: #ffc107;
    color: #856404;
}
body.comment-mode-active .owid-comment-icon {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
.owid-comment-popover {
    position: fixed;
    z-index: 10000;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    width: 380px;
    max-height: 550px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    overflow: hidden;
}
.owid-comment-popover-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 14px;
    background: #f8f9fa;
    border-bottom: 1px solid #e0e0e0;
    border-radius: 8px 8px 0 0;
}
.owid-comment-popover-title { font-size: 13px; color: #333; font-weight: 500; }
.owid-comment-popover-close {
    background: none;
    border: none;
    cursor: pointer;
    color: #666;
    font-size: 16px;
    padding: 4px 8px;
}
.owid-comment-popover-close:hover { color: #333; }
.owid-comment-popover-view-info {
    padding: 10px 14px;
    background: #e7f3ff;
    border-bottom: 1px solid #b8daff;
    font-size: 12px;
    color: #004085;
}
.owid-comment-popover-view-info strong {
    display: block;
    margin-top: 4px;
    font-size: 13px;
}
.owid-comment-popover-tabs {
    display: flex;
    border-bottom: 1px solid #e0e0e0;
    background: #fafafa;
}
.owid-comment-popover-tab {
    flex: 1;
    padding: 10px 12px;
    background: none;
    border: none;
    font-size: 12px;
    cursor: pointer;
    color: #666;
    border-bottom: 2px solid transparent;
    transition: all 0.15s;
}
.owid-comment-popover-tab:hover {
    background: #f0f0f0;
    color: #333;
}
.owid-comment-popover-tab.active {
    color: #002147;
    border-bottom-color: #002147;
    font-weight: 600;
}
.owid-comment-popover-tab .count {
    background: #e0e0e0;
    padding: 1px 6px;
    border-radius: 10px;
    font-size: 10px;
    margin-left: 4px;
}
.owid-comment-popover-tab.active .count {
    background: #002147;
    color: white;
}
.owid-comment-popover-list {
    max-height: 200px;
    overflow-y: auto;
    padding: 10px;
}
.owid-comment-popover-item {
    background: #f8f9fa;
    border-radius: 6px;
    padding: 10px 12px;
    margin-bottom: 10px;
    font-size: 13px;
    border-left: 3px solid #e0e0e0;
}
.owid-comment-popover-item:last-child { margin-bottom: 0; }
.owid-comment-popover-item.view-specific {
    border-left-color: #007bff;
}
.owid-comment-popover-item.all-views {
    border-left-color: #6c757d;
}
.owid-comment-popover-author { font-weight: 600; color: #333; font-size: 12px; }
.owid-comment-popover-content { color: #333; line-height: 1.5; margin-top: 4px; }
.owid-comment-popover-view-state {
    font-size: 10px;
    color: #666;
    margin-top: 6px;
    padding: 3px 8px;
    background: #e9ecef;
    border-radius: 3px;
    display: inline-block;
}
.owid-comment-popover-view-state.current-view {
    background: #cce5ff;
    color: #004085;
}
.owid-comment-popover-view-state.all-views {
    background: #e9ecef;
    color: #495057;
}
.owid-comment-popover-resolve {
    background: none;
    border: none;
    color: #28a745;
    font-size: 11px;
    cursor: pointer;
    padding: 4px 0;
    margin-top: 6px;
}
.owid-comment-popover-resolve:hover { text-decoration: underline; }
.owid-comment-popover-form {
    padding: 12px;
    border-top: 1px solid #e0e0e0;
}
.owid-comment-popover-form textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 13px;
    resize: none;
    font-family: inherit;
    box-sizing: border-box;
}
.owid-comment-popover-form textarea:focus { outline: none; border-color: #002147; }
.owid-comment-scope-toggle {
    display: flex;
    gap: 8px;
    margin: 10px 0;
}
.owid-comment-scope-option {
    flex: 1;
    padding: 8px 10px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: white;
    cursor: pointer;
    font-size: 12px;
    text-align: center;
    transition: all 0.15s;
}
.owid-comment-scope-option:hover {
    border-color: #002147;
}
.owid-comment-scope-option.selected {
    background: #002147;
    color: white;
    border-color: #002147;
}
.owid-comment-scope-option .scope-icon {
    display: block;
    font-size: 16px;
    margin-bottom: 2px;
}
.owid-comment-popover-submit {
    margin-top: 8px;
    background: #002147;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    width: 100%;
}
.owid-comment-popover-submit:disabled { opacity: 0.6; cursor: not-allowed; }
.owid-comment-popover-submit:hover:not(:disabled) { background: #003366; }
.owid-comment-popover-empty {
    padding: 16px;
    color: #666;
    font-size: 13px;
    text-align: center;
}
body.comment-mode-active .key-data { position: relative; }
body.comment-mode-active .key-data:hover {
    background: rgba(0, 33, 71, 0.05);
    border-radius: 4px;
}
</style>

<script>
(function() {
    const SLUG = '${slug}';
    const TARGET_TYPE = 'multidim';
    const DIMENSION_SLUGS = ${JSON.stringify(dimensionSlugs)};

    const FIELD_MAPPINGS = {
        'Source': { path: 'source', label: 'Source' },
        'Last updated': { path: 'lastUpdated', label: 'Last updated' },
        'Next expected update': { path: 'nextUpdate', label: 'Next expected update' },
        'Date range': { path: 'dateRange', label: 'Date range' },
        'Unit': { path: 'unit', label: 'Unit' },
        'Unit conversion factor': { path: 'unitConversionFactor', label: 'Unit conversion factor' },
        'Links': { path: 'links', label: 'Links' },
    };

    let allComments = [];  // All comments for this multidim
    let isCommentModeActive = false;
    let currentPopover = null;
    let activeTab = 'this-view';  // 'this-view' or 'all'
    let commentScope = 'this-view';  // For new comments: 'this-view' or 'all'

    // Get current view state from URL
    function getCurrentViewState() {
        const params = new URLSearchParams(window.location.search);
        const viewState = {};
        DIMENSION_SLUGS.forEach(dim => {
            const value = params.get(dim);
            if (value) viewState[dim] = value;
        });
        return Object.keys(viewState).length > 0 ? viewState : null;
    }

    function viewStateToString(viewState) {
        if (!viewState) return 'All views (general)';
        return Object.entries(viewState).map(([k, v]) => k + ': ' + v).join(' | ');
    }

    function viewStatesMatch(a, b) {
        if (!a && !b) return true;
        if (!a || !b) return false;
        const keysA = Object.keys(a).sort();
        const keysB = Object.keys(b).sort();
        if (keysA.length !== keysB.length) return false;
        return keysA.every((key, i) => key === keysB[i] && a[key] === b[key]);
    }

    // Fetch ALL comments for this multidim (we filter client-side)
    async function fetchComments() {
        try {
            const params = new URLSearchParams({
                targetType: TARGET_TYPE,
                targetId: SLUG,
                includeResolved: 'false'
            });
            const response = await fetch('/admin/api/comments.json?' + params.toString(), {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                allComments = data.comments || [];
                updateCommentCounts();
            }
        } catch (err) {
            console.error('Error fetching comments:', err);
        }
    }

    // Filter comments for display
    function getFilteredComments(fieldPath) {
        const currentView = getCurrentViewState();
        const fieldComments = allComments.filter(c => c.fieldPath === fieldPath);

        if (activeTab === 'this-view') {
            // Show comments for current view OR general comments (no viewState)
            return fieldComments.filter(c =>
                !c.viewState || viewStatesMatch(c.viewState, currentView)
            );
        } else {
            // Show all comments
            return fieldComments;
        }
    }

    async function createComment(fieldPath, content) {
        try {
            // If scope is 'all', don't include viewState
            const viewState = commentScope === 'this-view' ? getCurrentViewState() : null;
            const response = await fetch('/admin/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    targetType: TARGET_TYPE,
                    targetId: SLUG,
                    viewState: viewState,
                    fieldPath: fieldPath,
                    content: content
                })
            });
            if (response.ok) {
                await fetchComments();
                return true;
            }
        } catch (err) {
            console.error('Error creating comment:', err);
        }
        return false;
    }

    async function resolveComment(id) {
        try {
            const response = await fetch('/admin/api/comments/' + id + '/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: '{}'
            });
            if (response.ok) {
                await fetchComments();
            }
        } catch (err) {
            console.error('Error resolving comment:', err);
        }
    }

    function updateCommentCounts() {
        const currentView = getCurrentViewState();

        document.querySelectorAll('.owid-comment-icon').forEach(icon => {
            const fieldPath = icon.dataset.fieldPath;
            // Count comments relevant to current view
            const relevantComments = allComments.filter(c =>
                c.fieldPath === fieldPath &&
                (!c.viewState || viewStatesMatch(c.viewState, currentView))
            );
            const count = relevantComments.length;
            const badge = icon.querySelector('.badge');
            if (badge) {
                badge.textContent = count;
                badge.style.display = count > 0 ? 'inline' : 'none';
            }
            icon.classList.toggle('has-comments', count > 0);
        });

        // Count comments for current view vs other views
        const thisViewComments = allComments.filter(c =>
            !c.viewState || viewStatesMatch(c.viewState, currentView)
        );
        const otherViewsComments = allComments.filter(c =>
            c.viewState && !viewStatesMatch(c.viewState, currentView)
        );

        // Update toggle button badges
        const toggleBadge = document.querySelector('.owid-comment-toggle .badge');
        if (toggleBadge) {
            toggleBadge.textContent = thisViewComments.length;
            toggleBadge.style.display = thisViewComments.length > 0 ? 'inline' : 'none';
        }

        // Update "other views" badge
        let otherBadge = document.querySelector('.owid-comment-toggle .badge-other');
        if (!otherBadge && otherViewsComments.length > 0) {
            otherBadge = document.createElement('span');
            otherBadge.className = 'badge-other';
            document.querySelector('.owid-comment-toggle').appendChild(otherBadge);
        }
        if (otherBadge) {
            otherBadge.textContent = '+' + otherViewsComments.length + ' other';
            otherBadge.style.display = otherViewsComments.length > 0 ? 'inline' : 'none';
        }

        // Show/hide "other views" banner when in comment mode
        updateOtherViewsBanner(otherViewsComments);
    }

    function updateOtherViewsBanner(otherViewsComments) {
        let banner = document.querySelector('.owid-other-views-banner');

        if (!isCommentModeActive || otherViewsComments.length === 0) {
            if (banner) banner.remove();
            return;
        }

        if (!banner) {
            banner = document.createElement('div');
            banner.className = 'owid-other-views-banner';
            banner.addEventListener('click', () => showAllViewsPopover());
            document.body.appendChild(banner);
        }

        // Group by view
        const byView = {};
        otherViewsComments.forEach(c => {
            const key = viewStateToString(c.viewState);
            if (!byView[key]) byView[key] = [];
            byView[key].push(c);
        });
        const viewCount = Object.keys(byView).length;

        banner.innerHTML = \`
            <strong>📋 \${otherViewsComments.length} comments on \${viewCount} other view\${viewCount > 1 ? 's' : ''}</strong>
            <span>Click to see all comments across views</span>
        \`;
    }

    function navigateToView(viewState) {
        if (!viewState) return; // Can't navigate to "all views"
        const url = new URL(window.location.href);
        // Clear existing view params and set new ones
        DIMENSION_SLUGS.forEach(dim => url.searchParams.delete(dim));
        Object.entries(viewState).forEach(([key, value]) => {
            url.searchParams.set(key, value);
        });
        // Comment mode state is preserved via sessionStorage automatically
        window.location.href = url.toString();
    }

    function showAllViewsPopover() {
        closePopover();
        activeTab = 'all';

        const currentView = getCurrentViewState();
        const popover = document.createElement('div');
        popover.className = 'owid-comment-popover';
        popover.style.top = '100px';
        popover.style.left = '50%';
        popover.style.transform = 'translateX(-50%)';
        popover.style.width = '450px';
        popover.style.maxHeight = '70vh';

        // Group comments by view
        const byView = {};
        allComments.forEach(c => {
            const key = c.viewState ? viewStateToString(c.viewState) : 'All views (general)';
            if (!byView[key]) byView[key] = { viewState: c.viewState, comments: [] };
            byView[key].comments.push(c);
        });

        popover.innerHTML = \`
            <div class="owid-comment-popover-header">
                <span class="owid-comment-popover-title"><strong>All Comments</strong> (\${allComments.length} total)</span>
                <button class="owid-comment-popover-close">&times;</button>
            </div>
            <div class="owid-comment-popover-list" style="max-height: calc(70vh - 60px)">
                \${Object.entries(byView).map(([viewKey, data], idx) => {
                    const isCurrentView = viewStatesMatch(data.viewState, currentView);
                    const isClickable = data.viewState && !isCurrentView;
                    return \`
                        <div style="margin-bottom: 16px;">
                            <div class="view-header" data-view-idx="\${idx}" style="font-size: 12px; font-weight: 600; color: \${isCurrentView ? '#004085' : '#666'}; margin-bottom: 8px; padding: 6px 10px; background: \${isCurrentView ? '#cce5ff' : '#e9ecef'}; border-radius: 4px; \${isClickable ? 'cursor: pointer; transition: all 0.15s;' : ''}">
                                \${isCurrentView ? '📍 Current: ' : '📊 '}\${viewKey}
                                \${isClickable ? '<span style="float: right; font-size: 11px; color: #007bff;">→ Go to view</span>' : ''}
                            </div>
                            \${data.comments.map(c => \`
                                <div class="owid-comment-popover-item" style="margin-left: 8px;">
                                    <div class="owid-comment-popover-author">\${c.userFullName}</div>
                                    <div style="font-size: 11px; color: #888;">on <em>\${c.fieldPath || 'page'}</em></div>
                                    <div class="owid-comment-popover-content">\${c.content}</div>
                                    <button class="owid-comment-popover-resolve" data-id="\${c.id}">✓ Resolve</button>
                                </div>
                            \`).join('')}
                        </div>
                    \`;
                }).join('')}
            </div>
        \`;

        document.body.appendChild(popover);
        currentPopover = popover;

        // Store view data for click handlers
        const viewEntries = Object.entries(byView);

        popover.querySelector('.owid-comment-popover-close').addEventListener('click', closePopover);

        // Add click handlers to view headers
        popover.querySelectorAll('.view-header').forEach(header => {
            const idx = parseInt(header.dataset.viewIdx);
            const [, data] = viewEntries[idx];
            if (data.viewState && !viewStatesMatch(data.viewState, currentView)) {
                header.addEventListener('mouseenter', () => {
                    header.style.background = '#dee2e6';
                });
                header.addEventListener('mouseleave', () => {
                    header.style.background = '#e9ecef';
                });
                header.addEventListener('click', () => {
                    navigateToView(data.viewState);
                });
            }
        });

        popover.querySelectorAll('.owid-comment-popover-resolve').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = parseInt(e.target.dataset.id);
                await resolveComment(id);
                showAllViewsPopover();
            });
        });
    }

    function renderPopoverContent(fieldPath, fieldLabel) {
        if (!currentPopover) return;

        const fieldComments = getFilteredComments(fieldPath);
        const currentView = getCurrentViewState();
        const allFieldComments = allComments.filter(c => c.fieldPath === fieldPath);
        const viewSpecificCount = allFieldComments.filter(c =>
            !c.viewState || viewStatesMatch(c.viewState, currentView)
        ).length;

        const listContainer = currentPopover.querySelector('.owid-comment-popover-list');
        if (listContainer) {
            if (fieldComments.length > 0) {
                listContainer.innerHTML = fieldComments.map(c => {
                    const isViewSpecific = c.viewState !== null;
                    const isCurrentView = viewStatesMatch(c.viewState, currentView);
                    return \`
                        <div class="owid-comment-popover-item \${isViewSpecific ? 'view-specific' : 'all-views'}" data-id="\${c.id}">
                            <div class="owid-comment-popover-author">\${c.userFullName}</div>
                            <div class="owid-comment-popover-content">\${c.content}</div>
                            <div class="owid-comment-popover-view-state \${isViewSpecific ? (isCurrentView ? 'current-view' : '') : 'all-views'}">
                                \${isViewSpecific ? '📊 ' + viewStateToString(c.viewState) : '🌐 All views'}
                            </div>
                            <button class="owid-comment-popover-resolve" data-id="\${c.id}">✓ Resolve</button>
                        </div>
                    \`;
                }).join('');
            } else {
                listContainer.innerHTML = '<div class="owid-comment-popover-empty">No comments ' +
                    (activeTab === 'this-view' ? 'for this view' : '') + '</div>';
            }

            // Re-attach resolve listeners
            listContainer.querySelectorAll('.owid-comment-popover-resolve').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = parseInt(e.target.dataset.id);
                    await resolveComment(id);
                    renderPopoverContent(fieldPath, fieldLabel);
                });
            });
        }

        // Update tab counts
        const thisViewTab = currentPopover.querySelector('.owid-comment-popover-tab[data-tab="this-view"] .count');
        const allTab = currentPopover.querySelector('.owid-comment-popover-tab[data-tab="all"] .count');
        if (thisViewTab) thisViewTab.textContent = viewSpecificCount;
        if (allTab) allTab.textContent = allFieldComments.length;
    }

    function showPopover(icon, fieldPath, fieldLabel) {
        closePopover();
        activeTab = 'this-view';
        commentScope = 'this-view';

        const rect = icon.getBoundingClientRect();
        const currentView = getCurrentViewState();
        const allFieldComments = allComments.filter(c => c.fieldPath === fieldPath);
        const viewSpecificCount = allFieldComments.filter(c =>
            !c.viewState || viewStatesMatch(c.viewState, currentView)
        ).length;

        const popover = document.createElement('div');
        popover.className = 'owid-comment-popover';
        popover.style.top = (rect.bottom + window.scrollY + 8) + 'px';
        popover.style.left = Math.min(rect.left, window.innerWidth - 400) + 'px';

        popover.innerHTML = \`
            <div class="owid-comment-popover-header">
                <span class="owid-comment-popover-title">Comments on: <strong>\${fieldLabel}</strong></span>
                <button class="owid-comment-popover-close">&times;</button>
            </div>
            <div class="owid-comment-popover-view-info">
                📊 Current view: <strong>\${viewStateToString(currentView)}</strong>
            </div>
            <div class="owid-comment-popover-tabs">
                <button class="owid-comment-popover-tab active" data-tab="this-view">
                    This view <span class="count">\${viewSpecificCount}</span>
                </button>
                <button class="owid-comment-popover-tab" data-tab="all">
                    All views <span class="count">\${allFieldComments.length}</span>
                </button>
            </div>
            <div class="owid-comment-popover-list"></div>
            <form class="owid-comment-popover-form">
                <div class="owid-comment-scope-toggle">
                    <button type="button" class="owid-comment-scope-option selected" data-scope="this-view">
                        <span class="scope-icon">📊</span>
                        This view only
                    </button>
                    <button type="button" class="owid-comment-scope-option" data-scope="all">
                        <span class="scope-icon">🌐</span>
                        All views
                    </button>
                </div>
                <textarea placeholder="Add a comment..." rows="2"></textarea>
                <button type="submit" class="owid-comment-popover-submit">Add Comment</button>
            </form>
        \`;

        document.body.appendChild(popover);
        currentPopover = popover;

        renderPopoverContent(fieldPath, fieldLabel);

        popover.querySelector('.owid-comment-popover-close').addEventListener('click', closePopover);

        // Tab switching
        popover.querySelectorAll('.owid-comment-popover-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                activeTab = tab.dataset.tab;
                popover.querySelectorAll('.owid-comment-popover-tab').forEach(t =>
                    t.classList.toggle('active', t.dataset.tab === activeTab)
                );
                renderPopoverContent(fieldPath, fieldLabel);
            });
        });

        // Scope toggle for new comments
        popover.querySelectorAll('.owid-comment-scope-option').forEach(opt => {
            opt.addEventListener('click', () => {
                commentScope = opt.dataset.scope;
                popover.querySelectorAll('.owid-comment-scope-option').forEach(o =>
                    o.classList.toggle('selected', o.dataset.scope === commentScope)
                );
            });
        });

        const form = popover.querySelector('.owid-comment-popover-form');
        const textarea = form.querySelector('textarea');
        const submitBtn = form.querySelector('.owid-comment-popover-submit');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const content = textarea.value.trim();
            if (!content) return;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';
            const success = await createComment(fieldPath, content);
            if (success) {
                textarea.value = '';
                renderPopoverContent(fieldPath, fieldLabel);
            }
            submitBtn.disabled = false;
            submitBtn.textContent = 'Add Comment';
        });
    }

    function closePopover() {
        if (currentPopover) {
            currentPopover.remove();
            currentPopover = null;
        }
    }

    function addCommentIcon(element, fieldPath, fieldLabel, positionAbsolute = false) {
        if (!element || element.querySelector('.owid-comment-icon')) return;

        const icon = document.createElement('button');
        icon.className = 'owid-comment-icon';
        icon.dataset.fieldPath = fieldPath;
        icon.dataset.fieldLabel = fieldLabel;
        icon.innerHTML = '💬 <span class="badge" style="display:none">0</span>';
        icon.title = 'Comment on: ' + fieldLabel;
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            showPopover(icon, fieldPath, fieldLabel);
        });

        if (positionAbsolute) {
            element.style.position = 'relative';
            icon.style.position = 'absolute';
            icon.style.top = '0';
            icon.style.right = '0';
        } else {
            element.style.display = 'inline-flex';
            element.style.alignItems = 'center';
            element.style.gap = '8px';
        }
        element.appendChild(icon);
    }

    function addCommentIcons() {
        // Key data fields (Source, Unit, etc.)
        document.querySelectorAll('.key-data__title').forEach(titleEl => {
            const titleText = titleEl.textContent.trim();
            const fieldInfo = FIELD_MAPPINGS[titleText];
            if (!fieldInfo) return;
            addCommentIcon(titleEl, fieldInfo.path, fieldInfo.label);
        });

        // Key data title (indicator name)
        const mainTitle = document.querySelector('.key-data-description-short__title');
        addCommentIcon(mainTitle, 'indicatorTitle', 'Indicator title');

        // Key description
        const keyDescription = document.querySelector('.key-info__key-description');
        addCommentIcon(keyDescription, 'descriptionKey', 'Key description', true);

        // Chart header - title and subtitle
        const headerHTML = document.querySelector('.HeaderHTML');
        if (headerHTML) {
            const chartTitleEl = headerHTML.querySelector('h1');
            const chartSubtitleEl = headerHTML.querySelector('p');

            addCommentIcon(chartTitleEl, 'chartTitle', 'Chart title');
            addCommentIcon(chartSubtitleEl, 'chartSubtitle', 'Chart subtitle');
        }

        updateCommentCounts();
    }

    function init() {
        const toggle = document.createElement('button');
        toggle.className = 'owid-comment-toggle';
        toggle.innerHTML = '<span>💬 Comment Mode</span> <span class="badge" style="display:none">0</span>';
        toggle.addEventListener('click', toggleCommentMode);
        document.body.appendChild(toggle);

        document.addEventListener('click', (e) => {
            if (currentPopover && !currentPopover.contains(e.target) && !e.target.closest('.owid-comment-icon') && !e.target.closest('.owid-other-views-banner')) {
                closePopover();
            }
        });

        // Re-fetch comments and update counts when URL changes (view change)
        let lastUrl = window.location.href;
        setInterval(() => {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                fetchComments();
                closePopover();  // Close popover when view changes
            }
        }, 500);

        // Restore comment mode state from sessionStorage
        const shouldBeActive = sessionStorage.getItem('owidCommentModeActive') === 'true';
        if (shouldBeActive) {
            // Set visual state immediately
            isCommentModeActive = true;
            document.body.classList.add('comment-mode-active');
            toggle.classList.add('active');
            toggle.querySelector('span:first-child').textContent = '✓ Comment Mode ON';

            // Use MutationObserver to add icons when DOM elements become available
            waitForElementsAndAddIcons();
        }

        fetchComments();
    }

    let iconsAdded = false;

    // Watch for key DOM elements to appear and add icons when ready
    function waitForElementsAndAddIcons() {
        // Check if elements are already available
        const hasElements = document.querySelector('.key-data__title') || document.querySelector('.HeaderHTML');
        if (hasElements) {
            addCommentIcons();
            iconsAdded = document.querySelectorAll('.owid-comment-icon').length > 0;
            return;
        }

        // Otherwise, watch for them to appear
        const observer = new MutationObserver((mutations, obs) => {
            const hasElements = document.querySelector('.key-data__title') || document.querySelector('.HeaderHTML');
            if (hasElements) {
                obs.disconnect();
                addCommentIcons();
                iconsAdded = document.querySelectorAll('.owid-comment-icon').length > 0;
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    function toggleCommentMode() {
        isCommentModeActive = !isCommentModeActive;
        // Persist state to sessionStorage so it survives page navigation
        sessionStorage.setItem('owidCommentModeActive', isCommentModeActive ? 'true' : 'false');
        document.body.classList.toggle('comment-mode-active', isCommentModeActive);
        const btn = document.querySelector('.owid-comment-toggle');
        btn.classList.toggle('active', isCommentModeActive);
        btn.querySelector('span:first-child').textContent = isCommentModeActive ? '✓ Comment Mode ON' : '💬 Comment Mode';
        if (isCommentModeActive && !iconsAdded) {
            addCommentIcons();
            iconsAdded = document.querySelectorAll('.owid-comment-icon').length > 0;
            // If icons weren't added yet (elements not ready), watch for them
            if (!iconsAdded) {
                waitForElementsAndAddIcons();
            }
        }
        if (!isCommentModeActive) {
            closePopover();
        }
    }

    if (document.readyState === 'complete') {
        init();
    } else {
        window.addEventListener('load', init);
    }
})();
</script>
`
}
