@extends('app')

@section('styles')
	<link href="{{ asset('css/admin/import.css') }}" rel="stylesheet" type="text/css">
@endsection

@section('content')
	<div id="import-view" class="col-sm-12">
		<h2>Import</h2>
		<div class="file-picker-wrapper">
			<input type="file" />
			<a href="#" title="Remove uploaded file" class="remove-uploaded-file-btn"><span class="visuallyhidden">Remove uploaded file</span><i class="fa fa-remove"></i></a>
		</div>
		<div id="csv-import-result" class="csv-import-result"></div>
		{!! Form::open(array('class' => 'form-inline', 'method' => 'post', 'url' => 'import/store')) !!}
			{!! Form::text('data', 'example@gmail.com'); !!}
			{!! Form::submit('Store', array('class' => 'btn btn-primary')) !!}
		{!! Form::close() !!}
	</div>
@endsection

@section('scripts')
	<script src="{{ asset('js/app/views/App.Views.ImportView.js') }}"></script>
@endsection