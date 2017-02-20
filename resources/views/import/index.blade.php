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
		<h2>Import <a class="clear-settings-btn" style="display: none;">Clear Settings</a></h2>
		{!! Form::open(array('class' => 'form-inline validate-form', 'method' => 'post', 'url' => 'import/store')) !!}
			<input name="user_id" class="" type="hidden" value="{!! \Auth::user()->id !!}" />
			<section class="form-section dataset-type-section">
				<div class="form-section-header">
					<h3>Import mode</h3>
				</div>
				<div class="form-section-content">
					<p class="form-section-desc">Are you uploading multiple variables? Examples of valid layouts: <a href="http://ourworldindata.org/wp-content/uploads/2016/02/ourworldindata_single-var.png">single variable</a>, <a href="http://ourworldindata.org/wp-content/uploads/2016/02/ourworldindata_multi-var.png">multiple variables</a>.</p>
					<fieldset class="dataset-type-radiogroup">
						<label><input type="radio" class="" name="multivariant_dataset" value="0" checked/> Single variable in dataset</label>
						<label><input type="radio" class="" name="multivariant_dataset" value="1" /> Multiple variables in dataset</label>
					</fieldset>
					</div>
			</section>
			<section class="form-section upload-section">
					<div class="form-section-header">
						<h3>Upload file with data</h3>
					</div>
					<div class="form-section-content">
						<p class="form-section-desc">CSV file is preferred.
						<div class="file-picker-wrapper">
							<input type="file" autocomplete="off"/>
							<a href="#" title="Remove uploaded file" class="remove-uploaded-file-btn"><span class="visuallyhidden">Remove uploaded file</span><i class="fa fa-remove"></i></a>
						</div>
						<div class="csv-import-result">
							<div id="csv-import-table-wrapper" class="csv-import-table-wrapper"></div>
						</div>
					</div>
			</section>
			<section class="form-section variables-section">
					<div class="form-section-header">
						<h3>Check Variables</h3>
					</div>
					<div class="form-section-content">
						<p class="form-section-desc">Here you can configure the variables that will be stored for your dataset. If possible the variable name should be of the format measure + source (e.g. Population density – Clio Infra)</p>
						<ol></ol>						
						<div class="variable-validation"></div>
						<p class="affected-charts"></p>
					</div>
			</section>

			{!! Form::hidden('data', ''); !!}
			<section class="form-section submit-section">
				{!! Form::submit('Save dataset', array('class' => 'btn btn-success')) !!}
			</section>
		{!! Form::close() !!}
	</div>

	<div class="modal fade source-selector" role="dialog">
		<div class="modal-dialog modal-lg">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-label="Close">
						<span aria-hidden="true">&times;</span>
					</button>
					<h4 class="modal-title">Select source</h4>
				</div>
				<div class="modal-body">
					<label>
						<span>Source:</span>
						<select class="form-control source"></select>
					</label>
					<label class="source-name">
						<span>Name:</span>
						<input class="form-control required" type="text">
					</label>
					<label>
						<span>Description:</span>
						<textarea class="form-control source-editor required" type="text" name="source_description"></textarea>
						<span class="sources-default" style="display:none;">{!! $data['sourceTemplate']->meta_value !!}</span>
					</label>				
					<p class="form-section-desc">
						All provided source information will be shown on associated visualizations.
					</p>
				</div>
				<div class="modal-footer">
					<span class="existing-source-warning text-warning">
						<i class="fa fa-warning"></i>
						You are editing an existing source. Changes may also affect other variables.
					</span>
					<button class="btn btn-success">Save</button>
				</div>
			</div>
		</div>
	</div>
@endsection

@section('outter-content')
	@include('import/partials/_import-progress-popup')
@endsection

@section('scripts')
  <script type="text/javascript" src='//cdn.tinymce.com/4/tinymce.min.js'></script>
  <script>
    var importerData = {!! $importerData !!};
	new App.Views.ImportView(importerData); 
  </script>
@endsection