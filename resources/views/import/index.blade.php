@extends('app')

@section('styles')
	<link href="{{ asset('css/admin/import.css') }}" rel="stylesheet" type="text/css">
@endsection

@section('content')
	<div id="import-view" class="col-sm-12 import-view">
		<h2>Import</h2>
		{!! Form::open(array('class' => 'form-inline', 'method' => 'post', 'url' => 'import/store')) !!}
			<section class="form-section dataset-section">
					<div class="form-section-header">
						<h3><span class="form-section-digit">1</span>Choose your dataset?</h3>
					</div>
					<div class="form-section-content">
						<fieldset class="dataset-radiogroup">
							<label><input type="radio" class="" name="new_dataset" value="1" checked/> Create new dataset</label>
							<label><input type="radio" class="" name="new_dataset" value="0" /> Choose an existing dataset</label>
						</fieldset>
						<div class="new-dataset-section">
							{!! Form::text('new_dataset_name', '', array('class' => 'form-control ', 'placeholder' => 'Short name for variable' )); !!}
						</div>
						<div class="existing-dataset-section">
							<select name='existing_dataset_id' class="form-control">
								<option value="" disabled selected>Select your dataset</option>
								@foreach( $data['datasets'] as $dataset )
									<option value="{{ $dataset->id }}">{{ $dataset->name }}</option>
								@endforeach
							</select>
						</div>
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
			<section class="form-section category-section">
					<div class="form-section-header">
						<h3><span class="form-section-digit">4</span>Select category</h3>
					</div>
					<div class="form-section-content">
						<select name='category_id' class="form-control">
							<option value="" disabled selected>Select your category</option>
							@foreach( $data['categories'] as $category )
								<option value="{{ $category->id }}">{{ $category->name }}</option>
							@endforeach
						</select>
						<select name='subcategory_id' class="form-control">
							<option value="" disabled selected>Select your subcategory</option>
							@foreach( $data['subcategories'] as $subcategory )
								<option data-category-id="{{ $subcategory->fk_dst_cat_id }}" value="{{ $subcategory->id }}">{{ $subcategory->name }}</option>
							@endforeach
						</select>
					</div>
			</section>
			<section class="form-section category-section">
					<div class="form-section-header">
						<h3><span class="form-section-digit">5</span>Select variable type</h3>
					</div>
					<div class="form-section-content">
						<select name='variable_type' class="form-control">
							<option value="" disabled selected>Select variable type</option>
							@foreach( $data['varTypes'] as $varType )
								<option value="{{ $varType->id }}">{{ $varType->name }}</option>
							@endforeach
						</select>
					</div>
			</section>
			{!! Form::hidden('data', ''); !!}
			{!! Form::submit('Store', array('class' => 'btn btn-primary')) !!}
		{!! Form::close() !!}
	</div>
@endsection

@section('scripts')
	<script src="{{ asset('js/app/views/App.Views.ImportView.js') }}"></script>
@endsection