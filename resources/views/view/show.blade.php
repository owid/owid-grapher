@extends('view')

@section('content')
	@include('charts/partials/_chart')
@endsection

@section('outter-content')
	@include('charts/partials/_embed-modal')
@endsection

@section('scripts')
	<script>
		App.loadChart({!! json_encode($config) !!});
	</script>
@endsection