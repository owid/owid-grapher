/**
 * DARK MODE PROTOTYPE
 *
 * Inline, render-blocking script that sets the theme attributes on <html>
 * before first paint (no flash of the light theme on a statically baked page),
 * plus a small floating Light / Dark switcher to compare the two.
 *
 *   light – today's site
 *   dark  – dark site; charts stay light "islands"
 *
 * Override per page with `?theme=dark`. The choice is kept in localStorage
 * under "owid-theme".
 *
 * Earlier prototype values still work: "dark-a" and "dark-c" map to "dark",
 * and "system" follows the operating system. The dark-chart code (proposal C)
 * is still in place but isn't offered.
 */

const themeScript = `(function () {
    var KEY = "owid-theme";
    var MODES = ["light", "dark"];
    var mql = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

    function normalize(v) {
        if (v === "dark-a" || v === "dark-c") return "dark";
        if (v === "system") return mql && mql.matches ? "dark" : "light";
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

    var mode = stored();

    function apply() {
        var root = document.documentElement;
        root.setAttribute("data-theme", mode);
        // Charts stay light in the dark theme
        root.setAttribute("data-chart-theme", "light");
    }

    apply();

    window.__owidSetTheme = function (m) {
        mode = m;
        try { localStorage.setItem(KEY, m); } catch (e) {}
        apply();
        render();
    };

    var LABELS = { light: "Light", dark: "Dark" };

    var el;
    function render() {
        if (!el) return;
        el.innerHTML = "";
        var g = document.createElement("div");
        g.className = "theme-switcher__group";
        g.setAttribute("role", "group");
        g.setAttribute("aria-label", "Color theme (prototype)");
        MODES.forEach(function (m) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "theme-switcher__option";
            b.textContent = LABELS[m];
            b.setAttribute("aria-pressed", String(m === mode));
            b.addEventListener("click", function () { window.__owidSetTheme(m); });
            g.appendChild(b);
        });
        el.appendChild(g);
    }
    function mount() {
        el = document.createElement("div");
        el.className = "theme-switcher";
        document.body.appendChild(el);
        render();
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
    else mount();
})();`

export const ThemeScript = () => (
    <script dangerouslySetInnerHTML={{ __html: themeScript }} />
)
