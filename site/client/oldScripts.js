window.$ = window.jQuery = require('jquery')
require ('./tooltip.js')

// Construct scroll-friendly nav sidebar for entries. Should be idempotent so it
// can be called again to reconstruct on window resize
var OWIDScrollNav = function() {
	var $page = $("article.page"),
		$sidebar = $(".entry-sidebar");

	if (!$page.length || !$sidebar.length || $(".no-sidebar").length) return;

	// Don't make sidebar unless there are enough headings
	if ($page.find('h2').length < 2) return;

	// Cleanup any existing stuff
	$sidebar.attr('style', '');
	$(window).off('scroll.toc');

	// Keep track of sections so we can find the closest one
	var headings = $(".articleHeader h1, .article-content h2, .article-content h3").map(function(i, el) { return $(el); })

	var currentHeadingIndex = null;
	var onScroll = function() {
		var scrollTop = $(document).scrollTop();

		// Figure out where in the document we are
		var lastHeadingIndex = null;
		headings.each(function(i, $heading) {
			// HACK (Mispy): The +50 is so being right on top of the heading after you
			// click a link in the TOC still counts as being under it
			if ($heading.offset().top <= scrollTop+50)
				lastHeadingIndex = i;
		});

		if (lastHeadingIndex != currentHeadingIndex) {
			$sidebar.find("li.active").removeClass("active");
			currentHeadingIndex = lastHeadingIndex;
			if (currentHeadingIndex !== null)
				$sidebar.find("li").eq(currentHeadingIndex).addClass("active");
		}
	};

	onScroll();
	$(window).on('scroll.toc', onScroll);
};

OWIDScrollNav();

$(window).on('resize.toc', OWIDScrollNav);

// Don't let user enter empty search query
$(".search-form").on("submit", function(evt) {
	if ($(evt.target).find("input[type=search]").val() === '')
		evt.preventDefault();
});

$(".citation-note").on('click', function() {
	$(".citation-guideline").toggle();
});

$("a.ref sup").removeAttr("title");

$("a.ref sup").tooltip({
	html: true,
	delay: { show: 100, hide: 500 },
	placement: 'auto right',
	trigger: 'manual',
	title: function() {
		var selector = $(this).closest('a.ref').attr('href');
		return $(selector).html();
	}
});

$("a.ref sup").on("mouseover", function() {
	var $sup = $(this);
	$sup.tooltip('show');

	$("body").on("mouseover.tooltip", function(evt) {
		if (!$(evt.target).closest(".tooltip").length && !$(evt.target).closest(".ref").length) {
			$sup.tooltip('hide');
			$('body').off('mouseover.tooltip');
		}
	});
});

if (document.cookie.indexOf('wordpress') != -1 || document.cookie.indexOf('wp-settings') != -1 || document.cookie.indexOf('isAdmin') != -1) {
    $('#wpadminbar').show();
}

$("html").addClass('js');
