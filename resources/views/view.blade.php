<!doctype html>
<html class="no-js" lang="">
	<head>
		<meta charset="utf-8">
		<meta http-equiv="x-ua-compatible" content="ie=edge">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		@if (isset($chartMeta))
			<title>{{ $chartMeta->title }} - Our World In Data</title>
			<meta name="description" content="{{ $chartMeta->description }}">
		@endif
		<link rel="apple-touch-icon" href="apple-touch-icon.png">
		@if (isset($chartMeta))
			@if (isset($query))
			    <meta name="robots" content="noindex">
			@else
				<link rel="canonical" href="{{ $chartMeta->canonicalUrl }}">
			@endif
			<meta property="fb:app_id" content="1149943818390250">
			<meta property="og:url" content="{!! $chartMeta->canonicalUrl !!}">
			<meta property="og:title" content="{{ $chartMeta->title }}">
			<meta property="og:description" content="{{ $chartMeta->description }}">
			<meta property="og:image" content="{!! $chartMeta->imageUrl !!}">
			<meta property="og:image:width" content="1200">
			<meta property="og:image:height" content="800">
			<meta property="og:site_name" content="Our World In Data">

			<meta name="twitter:card" content="summary_large_image">
			<meta name="twitter:site" content="@MaxCRoser">
			<meta name="twitter:creator" content="@MaxCRoser">
			<meta name="twitter:title" content="{{ $chartMeta->title }}">
			<meta name="twitter:description" content="{{ $chartMeta->description }}">
			<meta name="twitter:image" content="{!! $chartMeta->imageUrl !!}">
		@endif

		<?php Assets::add("chart"); ?>
		<?php echo App\Util::css(); ?>
	</head>
	<body>
		<!--[if lt IE 9]>
			<p class="browserupgrade">You are using an <strong>outdated</strong> browser. Please <a href="http://browsehappy.com/">upgrade your browser</a> to improve your experience.</p>
		<![endif]-->

		@yield('content')
		
		<script>
			var Global = {};
			Global.rootUrl = "{!! Request::root() !!}";

			window.App = {}
			App.isEditor = false;
			App.loadChart = function(chartConfig) {
				var chart = owid.chart().update({ chartConfig: chartConfig, containerNode: d3.select('body').node() });
			};		
		</script>
		
		<script src="{{ URL::to('/build/bundle.js') }}"></script>
		
		@yield('scripts')
	</body>
</html>

