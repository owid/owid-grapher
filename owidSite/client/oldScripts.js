window.$ = window.jQuery = require("jquery")
require("./tooltip.js")

// Don't let user enter empty search query
$(".search-form").on("submit", function(evt) {
    if (
        $(evt.target)
            .find("input[type=search]")
            .val() === ""
    )
        evt.preventDefault()
})

$(".citation-note").on("click", function() {
    $(".citation-guideline").toggle()
})

$("a.ref sup").removeAttr("title")

$("a.ref sup").tooltip({
    html: true,
    delay: { show: 100, hide: 500 },
    placement: "auto right",
    trigger: "manual",
    title: function() {
        var selector = $(this)
            .closest("a.ref")
            .attr("href")
        return $(selector).html()
    }
})

$("a.ref sup").on("mouseover", function() {
    var $sup = $(this)
    $sup.tooltip("show")

    $("body").on("mouseover.tooltip", function(evt) {
        if (
            !$(evt.target).closest(".tooltip").length &&
            !$(evt.target).closest(".ref").length
        ) {
            $sup.tooltip("hide")
            $("body").off("mouseover.tooltip")
        }
    })
})

if (
    document.cookie.indexOf("wordpress") != -1 ||
    document.cookie.indexOf("wp-settings") != -1 ||
    document.cookie.indexOf("isAdmin") != -1
) {
    $("#wpadminbar").show()
}

$("html").addClass("js")
