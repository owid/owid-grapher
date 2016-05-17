@extends('view')

@section('content')
	<div class="standalone-chart-viewer" style="position:absolute;top:0;left:0;right:0;bottom:0;">
		@include('charts/partials/_chart')
	</div>
@endsection

@section('outter-content')
	@include('charts/partials/_embed-modal')
@endsection

@section('scripts')
	<script src="{{ asset(elixir('js/ChartApp.js')) }}"></script>
	<script>
		App.loadChart({!! json_encode($config) !!});
	</script>
@endsection