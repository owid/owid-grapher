/* global dynamicData */
;(function($) {


	$(document).ready(function() {

		var $result = $(".search-results"), 
			processing = false;

		$('.load-more-btn').click(function(evt){

			evt.preventDefault();

			//isn't there active query
			if( processing ) {
				return false;
			}

			var $this = $(this),
				ajaxUrl = $this.attr("data-ajax-url"),
				searchQuery = $this.attr("data-search-query"),
				paged = $this.attr("data-paged"),
				postsPerPage = $this.attr("data-posts-per-page"),
				orderBy = $this.attr("data-orderby");
			
			jQuery.ajax({
				type: 'post',
				url: ajaxUrl,
				data: {
					action: 'load_search_results',
					query: searchQuery,
					paged: paged,
					/*jshint camelcase: false */
					posts_per_page: postsPerPage,
					orderby: orderBy
				},
				beforeSend: function() {
					processing = true;
					$this.css("opacity",".25");	
				},
				success: function(response) {
					processing = false;
					$this.css("opacity","1");
					$result.append( response );
					
					//incremenet paged indicator so that next search load more posts
					var newPagedIndex = +paged + 1;
					$this.attr("data-paged", newPagedIndex );
				}
			});

			return false;

		});

	});

})(jQuery);

