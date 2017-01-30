@extends('view')

@section('content')
	<style>
		iframe {
			border: 0;
			width: 914px;
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
			@if ($compare)
				<iframe src="{{ $chart['localUrl'] }}"></iframe>
				<iframe src="{{ $chart['liveUrl'] }}"></iframe>
			@else
				<iframe src="{{ $chart['localUrl'] }}"></iframe>
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
	</script>
@endsection

