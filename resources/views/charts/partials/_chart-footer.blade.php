<div class="chart-footer clearfix">
	<div class="export-footer-btns">
		<a href="#" class="chart-export-btn" target="_blank">Save chart</a>
		<a href="#" class="chart-save-btn" style="display:none;"></a>
	</div>
	@if (!empty(Request::header('referer')) && parse_url(Request::header('referer'))['host'] == parse_url(Config::get("app.url"))['host'])
		<a class="fancybox-iframe" href="{{ Request::url() }}">Full screen view</a>
	@endif
	<p class="chart-sources"></p>
	<p class="chart-description"></p>
</div>