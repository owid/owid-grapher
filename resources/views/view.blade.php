<!doctype html>
<html class="no-js" lang="">
	<head>
		<meta charset="utf-8">
		<meta http-equiv="x-ua-compatible" content="ie=edge">
		<title>Our World In Data - Chart Builder</title>
		<meta name="description" content="">
		<meta name='viewport' content='width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'>
		<link rel="apple-touch-icon" href="apple-touch-icon.png">
		<!-- Place favicon.ico in the root directory -->

		@if (isset($chartMeta))
			<meta name="twitter:card" content="summary_large_image">
			<meta name="twitter:site" content="@MaxCRoser">
			<meta name="twitter:creator" content="@MaxCRoser">
			<meta name="twitter:title" content="{{ $chartMeta->title }}">
			<meta name="twitter:description" content="{{ $chartMeta->description }}">
			<meta name="twitter:image" content="{{ $chartMeta->imageUrl }}">
		@endif

		<link href="{{ asset(elixir('css/front.css')) }}" rel="stylesheet" type="text/css" />		

		@if (!empty($canonicalUrl))
			<link rel="canonical" href="{{ $canonicalUrl }}" />
		@endif

		@yield('styles')
		
		<style>

			/*.nv-point {
				fill-opacity: 1 !important;
			}
			path.nv-line {
				opacity: 0;
			}*/

		</style>

	</head>
	<body>
		<!--[if lt IE 9]>
			<p class="browserupgrade">You are using an <strong>outdated</strong> browser. Please <a href="http://browsehappy.com/">upgrade your browser</a> to improve your experience.</p>
		<![endif]-->

		<div class="wrapper">
			@yield('content')
		</div>
		@yield('outter-content')
		
		<script>
			var Global = {};
			Global.rootUrl = "{!! Request::root() !!}";
		</script>
		
		<script src="{{ asset(elixir('js/libs.js')) }}"></script>
		
		@yield('scripts')
	</body>
</html>

