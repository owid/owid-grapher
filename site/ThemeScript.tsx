/**
 * DARK MODE PROTOTYPE
 *
 * Inline, render-blocking script that sets the theme attributes on <html>
 * before first paint (no flash of the light theme on a statically baked page),
 * plus a small floating switcher to compare the proposals.
 *
 * Modes:
 *   light   – today's site
 *   dark-a  – proposal A: dark site, charts stay light "islands"
 *   system  – follows prefers-color-scheme (dark → dark-a)
 *
 * Proposal C (dark charts with adapted data colors) has been removed from the
 * options; "dark-c" is mapped to "dark-a". Its chart code is still in place.
 *
 * Override per page with `?theme=dark-a` etc. The choice is kept in
 * localStorage under "owid-theme".
 */

const themeScript = `(function () {
    var KEY = "owid-theme";
    var MODES = ["light", "dark-a", "system"];
    // Dark C was removed from the options; anyone who had it picked (or a
    // shared ?theme=dark-c link) lands on Dark A instead of falling back to
    // light. The dark-chart code is still in place if it's needed again.
    var RETIRED = { "dark-c": "dark-a" };
    var mql = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

    function normalize(v) {
        if (v && RETIRED[v]) return RETIRED[v];
        return MODES.indexOf(v) !== -1 ? v : null;
    }

    function stored() {
        try {
            var fromUrl = normalize(new URLSearchParams(location.search).get("theme"));
            if (fromUrl) {
                localStorage.setItem(KEY, fromUrl);
                return fromUrl;
            }
            var v = normalize(localStorage.getItem(KEY));
            if (v) localStorage.setItem(KEY, v);
            return v || "light";
        } catch (e) {
            return "light";
        }
    }

    function resolve(mode) {
        if (mode === "system") return mql && mql.matches ? "dark-a" : "light";
        return mode;
    }

    function apply(mode) {
        var r = resolve(mode);
        var root = document.documentElement;
        root.setAttribute("data-theme-mode", mode);
        root.setAttribute("data-theme", r === "light" ? "light" : "dark");
        root.setAttribute("data-chart-theme", r === "dark-c" ? "dark" : "light");
    }

    var mode = stored();
    apply(mode);
    if (mql && mql.addEventListener) {
        mql.addEventListener("change", function () { apply(mode); });
    }

    window.__owidSetTheme = function (m) {
        mode = m;
        try { localStorage.setItem(KEY, m); } catch (e) {}
        apply(m);
        render();
    };

    var LABELS = { light: "Light", "dark-a": "Dark · A", system: "System" };
    var TITLES = {
        light: "Today's site",
        "dark-a": "Proposal A: dark site, charts stay light",
        system: "Follow the operating system (dark uses proposal A)"
    };
    var el;
    function render() {
        if (!el) return;
        el.innerHTML = "";
        MODES.forEach(function (m) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "theme-switcher__option";
            b.textContent = LABELS[m];
            b.title = TITLES[m];
            b.setAttribute("aria-pressed", String(m === mode));
            b.addEventListener("click", function () { window.__owidSetTheme(m); });
            el.appendChild(b);
        });
    }
    function mount() {
        el = document.createElement("div");
        el.className = "theme-switcher";
        el.setAttribute("role", "group");
        el.setAttribute("aria-label", "Color theme (prototype)");
        document.body.appendChild(el);
        render();
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
    else mount();
})();`

export const ThemeScript = () => (
    <script dangerouslySetInnerHTML={{ __html: themeScript }} />
)
