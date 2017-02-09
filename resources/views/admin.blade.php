<!doctype html>
<html class="no-js" lang="">
	<head>
		<meta charset="utf-8">
		<meta http-equiv="x-ua-compatible" content="ie=edge">
		<meta name="_token" value="{{ csrf_token() }}">
		<title>owid-grapher</title>
		<meta name="description" content="">
		<meta name='viewport' content='width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'>
		
		<link rel="apple-touch-icon" href="apple-touch-icon.png">
		<link href="https://fonts.googleapis.com/css?family=Source+Sans+Pro:300,400,600,700,300italic,400italic,600italic" rel="stylesheet" type="text/css">
		<!-- Place favicon.ico in the root directory -->

		<?php Assets::add('admin'); ?>
		<?php echo App\Util::css(); ?>
	</head>
	<body class="skin-blue">
		<!--[if lt IE 9]>
			<p class="browserupgrade">You are using an <strong>outdated</strong> browser. Please <a href="http://browsehappy.com/">upgrade your browser</a> to improve your experience.</p>
		<![endif]-->

		<div class="wrapper">
			<header class="main-header">
				<a href="https://github.com/ourworldindata/owid-grapher" class="logo">owid-grapher</a>
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
						<li><a href="{!! route( 'sources.index' ) !!}"><i class="fa fa-link"></i> Sources</a></li>
						<li class="header">SETTINGS</li>
						<li><a href="{!! route( 'users.index' ) !!}"><i class="fa fa-users"></i> Users</a></li>
						<li><a href="{!! route( 'licenses.index' ) !!}"><i class="fa fa-gavel"></i> Licenses</a></li>
						<li><a href="{!! route( 'categories.index' ) !!}"><i class="fa fa-folder"></i> Categories</a></li>
						<li><a href="{!! route( 'tags.index' ) !!}"><i class="fa fa-tags"></i> Tags</a></li>
						<li><a href="{!! route( 'apiKeys.index' ) !!}"><i class="fa fa-credit-card"></i> API keys</a></li>
						<li><a href="{!! route( 'logos.index' ) !!}"><i class="fa fa-picture-o"></i> Logos</a></li>
						<li><a href="{!! route( 'sourceTemplate' ) !!}"><i class="fa fa-link"></i> Datasource template</a></li>
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
				@if($errors->has())
					@foreach ($errors->all() as $error)
					  <div class="flash alert-error">
					  	<p>{{ $error }}</p>
					  </div>
					@endforeach
				@endif
				@yield('content')
			</div>
		</div>
		@yield('outter-content')

		<script>
			var Global = {};
			Global.rootUrl = "{!! Request::root() !!}";

			window.App = {}
			App.isEditor = true
		</script>
		
		<script src="{{ URL::to('/build/admin.bundle.js') }}"></script>
		@yield('scripts')
	</body>
</html>

