@extends('view')

@section('content')
	<div class="row" style="padding: 20px;">
		@foreach ($charts as $chart)
			<div class="col-md-6">
				<a href="{{ $chart['localUrl'] }}">{{ $chart['localUrl'] }}</a>
				<iframe src="{{ $chart['localUrl'] }}" style="width: 100%; height: 700px;"></iframe>
			</div>
			<div class="col-md-6">
				<a href="{{ $chart['liveUrl'] }}">{{ $chart['liveUrl'] }}</a>
				<iframe src="{{ $chart['liveUrl'] }}" style="width: 100%; height: 700px;"></iframe>
			</div>
		@endforeach
	</div>
@endsection
