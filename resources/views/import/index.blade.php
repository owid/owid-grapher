@extends('admin')

@section('content')
	<div id="import-view" class="col-sm-12 import-view">
		@if($errors->has())
			<div class="alert alert-danger alert-dismissable">
				<button type="button" class="close" data-dismiss="alert" aria-hidden="true">×</button>
				@foreach ($errors->all() as $error)
					<div>{{ $error }}</div>
				@endforeach
			</div>
		@endif
	</div>
@endsection

@section('scripts')
  <script>
    var importerData = {!! $importerData !!};
	new App.Views.ImportView(importerData); 
  </script>
@endsection