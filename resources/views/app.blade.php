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

		<link href="{{ elixir('css/libs/admin.css') }}" rel="stylesheet" type="text/css" />
		<link href="{{ elixir('css/admin.css') }}" rel="stylesheet" type="text/css" />

		@yield('styles')

		<script src="{{ asset('build/js/modernizr-2.8.3.min.js') }}"></script>
		
		<style>

			/*.nv-point {
				fill-opacity: 1 !important;
			}
			path.nv-line {
				opacity: 0;
			}*/

		</style>

	</head>
	<body class="skin-blue">
		<!--[if lt IE 9]>
			<p class="browserupgrade">You are using an <strong>outdated</strong> browser. Please <a href="http://browsehappy.com/">upgrade your browser</a> to improve your experience.</p>
		<![endif]-->

		<div class="wrapper">
			<header class="main-header">
				<a href="#" class="logo"><b style="font-size:16px;">OurWorldInData-Grapher</b></a>
				<nav class="navbar navbar-static-top">
					<a href="#" class="sidebar-toggle" data-toggle="offcanvas" role="button">
						<span class="sr-only">Toggle navigation</span>
					</a>
					<div class="navbar-custom-menu">
						<ul class="nav navbar-nav">
							<li class="dropdown user user-menu">
								@if (Auth::user())
									<a href="{!! route( 'logout' ) !!}">
										<span class="hidden-xs">Signed in as <strong>{{ Auth::user()->name }}</strong></span>
									</a>
								@endif
							</li>
						</ul>
					</div>
				</nav>
			</header>
			<aside class="main-sidebar">
				<!-- sidebar: style can be found in sidebar.less -->
				<section class="sidebar" style="height: auto;">
					<!-- sidebar menu: : style can be found in sidebar.less -->
					<ul class="sidebar-menu">
						<li class="header">CHARTS</li>
						<li><a href="{!! route( 'charts.index' ) !!}"><i class="fa fa-bar-chart"></i> Charts</a></li>
						<li class="header">IMPORT</li>
						<li><a href="{!! route( 'import' ) !!}"><i class="fa fa-upload"></i> Import new data</a></li>
						<li class="header">DATA MANAGEMENT</li>
						<li><a href="{!! route( 'entities.index' ) !!}"><i class="fa fa-flag"></i> Entities</a></li>
						<li><a href="{!! route( 'datasets.index' ) !!}"><i class="fa fa-table"></i> Datasets</a></li>
						<li><a href="{!! route( 'datasources.index' ) !!}"><i class="fa fa-link"></i> Sources</a></li>
						<li class="header">SETTINGS</li>
						<li><a href="{!! route( 'licenses.index' ) !!}"><i class="fa fa-gavel"></i> Licenses</a></li>
						<li><a href="{!! route( 'categories.index' ) !!}"><i class="fa fa-folder"></i> Categories</a></li>
						<li><a href="{!! route( 'tags.index' ) !!}"><i class="fa fa-tags"></i> Tags</a></li>
						<li><a href="{!! route( 'logo' ) !!}"><i class="fa fa-picture-o"></i> Logo</a></li>
					</ul>
				</section>
				<!-- /.sidebar -->
			  </aside>
			<div class="content-wrapper">
				@if (Session::has('message'))
					<div class="flash alert-@if(Session::has('message-class')){{Session::get('message-class')}}@else{{'info'}}@endif">
						<p>{{ Session::get('message') }}</p>
					</div>
				@endif
				@yield('content')
			</div>
		</div>
		@yield('outter-content')
		<script>
			var Global = {};
			Global.rootUrl = "{!! Request::root() !!}";
		</script>

		<script src="{{ elixir('js/libs-admin.js') }}"></script>
		<script src="{{ elixir('js/FormApp.js') }}"></script>
		
		@yield('scripts')

		<!-- Google Analytics: change UA-XXXXX-X to be your site's ID. -->
		<script>
			(function(b,o,i,l,e,r){b.GoogleAnalyticsObject=l;b[l]||(b[l]=
			function(){(b[l].q=b[l].q||[]).push(arguments)});b[l].l=+new Date;
			e=o.createElement(i);r=o.getElementsByTagName(i)[0];
			e.src='https://www.google-analytics.com/analytics.js';
			r.parentNode.insertBefore(e,r)}(window,document,'script','ga'));
			ga('create','UA-XXXXX-X','auto');ga('send','pageview');
		</script>
	</body>
</html>

