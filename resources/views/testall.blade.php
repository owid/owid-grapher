@extends('view')

@section('content')
	<style>
		iframe {
			border: 0;
			max-width: 800px;
			width: 100%;
			height: 660px;
			margin: auto;
		}

		.row {
			padding: 10px;
		}

		.col-md-6 {
			display: flex;
		}

		nav.pagination {
			width: 100%;
			text-align: center;
		}
	</style>

	@foreach ($urls as $chart)
		<div class="row">
			@if ($chart['localUrl'] != $chart['liveUrl'])
				<div class="col-md-6">
					<iframe data-src="{{ $chart['localUrl'] }}"></iframe>
				</div>
				<div class="col-md-6">
					<iframe data-src="{{ $chart['liveUrl'] }}"></iframe>
				</div>
			@else
				<div class="col-md-12">
					<iframe data-src="{{ $chart['liveUrl'] }}"></iframe>
				</div>
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
	$(document).on('keypress', function(evt) {
		if (evt.keyCode == 13) {
			$(".row:eq(0)").remove();
			$(document).scroll();
		}
	});
</script>
@endsection