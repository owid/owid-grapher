@extends('view')

@section('styles')
<style>
	iframe {
		border: 0;
	}
</style>
@endsection

@section('content')
	@foreach ($charts as $chart)
		<div class="row" style="padding: 20px;">
			@if ($chart['localUrl'] != $chart['liveUrl'])
				<div class="col-md-6">
					<iframe data-src="{{ $chart['localUrl'] }}" style="width: 100%; height: 700px;"></iframe>
				</div>
				<div class="col-md-6">
					<iframe data-src="{{ $chart['liveUrl'] }}" style="width: 100%; height: 700px;"></iframe>
				</div>
			@else
				<div class="col-md-12">
					<iframe data-src="{{ $chart['liveUrl'] }}" style="width: 100%; height: 700px;"></iframe>
				</div>
			@endif			
		</div>
	@endforeach
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