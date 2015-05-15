@extends('app')

@section('styles')
	<link href="{{ asset('css/admin/import.css') }}" rel="stylesheet" type="text/css">
@endsection

@section('content')
	<div id="import-view" class="col-sm-12 import-view">
		<h2>Import</h2>
		{!! Form::open(array('class' => 'form-inline', 'method' => 'post', 'url' => 'import/store')) !!}
			<section class="form-section variable-name-section">
					<div class="form-section-header">
						<h3><span class="form-section-digit">1</span>What is in your dataset?</h3>
					</div>
					<div class="form-section-content">
						{!! Form::text('variable_name', '', array('class' => 'form-control ', 'placeholder' => 'Short name for variable' )); !!}
					</div>
			</section>
			<section class="form-section">
					<div class="form-section-header">
						<h3><span class="form-section-digit">2</span>Upload file with data</h3>
					</div>
					<div class="form-section-content">
						<p class="form-section-desc">For now, just CSV files are working</p>
						<div class="file-picker-wrapper">
							<input type="file" />
							<a href="#" title="Remove uploaded file" class="remove-uploaded-file-btn"><span class="visuallyhidden">Remove uploaded file</span><i class="fa fa-remove"></i></a>
						</div>
						<div id="csv-import-result" class="csv-import-result"></div>
					</div>
			</section>
			
			{!! Form::hidden('data', 'example@gmail.com'); !!}
			{!! Form::submit('Store', array('class' => 'btn btn-primary')) !!}
		{!! Form::close() !!}
	</div>
@endsection

@section('scripts')
	<script src="{{ asset('js/app/views/App.Views.ImportView.js') }}"></script>
@endsection