@extends('view')

@section('content')
	<style>
		iframe {
			border: 0;
			max-width: 800px;
			width: 100%;
			height: 600px;
		}

		.row {
			padding: 10px;
			margin: 0;
			display: flex;		
			align-items: center;	
			justify-content: center;
			width: 100%;
		}

		nav.pagination {
			width: 100%;
			text-align: center;
		}
	</style>

	@foreach ($urls as $chart)
		<div class="row">
			@if ($chart['localUrl'] != $chart['liveUrl'])
				<iframe src="{{ $chart['localUrl'] }}"></iframe>
				<iframe src="{{ $chart['liveUrl'] }}"></iframe>
			@else
				<iframe src="{{ $chart['liveUrl'] }}"></iframe>
			@endif			
		</div>
	@endforeach


	<nav class="pagination">
		@if ($prevPageUrl)
			<a href="{{ $prevPageUrl }}"><< Prev</a>
		@endif
		@if ($nextPageUrl)
			<a href="{{ $nextPageUrl }}">Next >></a>
		@endif
	</nav>
@endsection

@section('scripts')
	<script>
		$('iframe').css({
			width: 640,
			height: 660
		})
	</script>
@endsection

