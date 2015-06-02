@extends('app')

@section('styles')
	<link href="{{ asset('css/admin/import.css') }}" rel="stylesheet" type="text/css">
@endsection

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
		<h2>Import</h2>
		{!! Form::open(array('class' => 'form-inline', 'method' => 'post', 'url' => 'import/store')) !!}
			<section class="form-section dataset-section">
					<div class="form-section-header">
						<h3><span class="form-section-digit">1</span>Choose your dataset</h3>
					</div>
					<div class="form-section-content">
						<fieldset class="dataset-radiogroup">
							<label><input type="radio" class="" name="new_dataset" value="1" checked/> Create new dataset</label>
							<label><input type="radio" class="" name="new_dataset" value="0" /> Choose an existing dataset</label>
						</fieldset>
						<div class="new-dataset-section">
							{!! Form::text('new_dataset_name', '', array('class' => 'form-control ', 'placeholder' => 'Short name for your dataste' )); !!}
							<a href="#" class="new-dataset-description-btn"><i class="fa fa-plus"></i><span>Add dataset description<span></a>
							{!! Form::textarea ('new_dataset_description', '', array('class' => 'form-control new-dataset-description', 'placeholder' => 'Optional description for dataset' )); !!}
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
			<section class="form-section upload-section">
					<div class="form-section-header">
						<h3><span class="form-section-digit">2</span>Upload file with data</h3>
					</div>
					<div class="form-section-content">
						<p class="form-section-desc">For now, just CSV files are working. We'll have xls and choice of external source (e.g. Gapminder) in the future.</p>
						<div class="file-picker-wrapper">
							<input type="file" />
							<a href="#" title="Remove uploaded file" class="remove-uploaded-file-btn"><span class="visuallyhidden">Remove uploaded file</span><i class="fa fa-remove"></i></a>
						</div>
						<div class="csv-import-result">
							<div id="csv-import-table-wrapper" class="csv-import-table-wrapper"></div>
						</div>
					</div>
			</section>
			<section class="form-section dataset-type-section">
					<div class="form-section-header">
						<h3><span class="form-section-digit">3</span>Dataset type</h3>
					</div>
					<div class="form-section-content">
						<p class="form-section-desc">Do you have multiple variables in your dataset? In most cases, it will be only single variable.</p>
						<fieldset class="dataset-type-radiogroup">
							<label><input type="radio" class="" name="multivariant_dataset" value="0" checked/> Single variable in dataset</label>
							<label><input type="radio" class="" name="multivariant_dataset" value="1" /> Multiple variables in dataset</label>
						</fieldset>
					</div>
			</section>
			<section class="form-section variables-section">
					<div class="form-section-header">
						<h3><span class="form-section-digit">4</span>Check Variables</h3>
					</div>
					<div class="form-section-content">
						<p class="form-section-desc">Here you can check which variables will be stored for your dataset. Names for variable are either taken from dataset name, if you have just one variable, or from name of the columns in uploaded data, if you have more variables. For each variable you can optionally add unit and its description. If you think that's usefull.</p>
						<ol></ol>
					</div>
			</section>
			<section class="form-section category-section">
					<div class="form-section-header">
						<h3><span class="form-section-digit">5</span>Select category</h3>
					</div>
					<div class="form-section-content">
						<p class="form-section-desc">Properly categorizing dataset by selecting category and sub-category will help you to find it easier later. If you feel like there are some keywords that describe dataset well, you can add them as tags. For now just write tags separated by comma.</p>
						<label>Category
							<select name='category_id' class="form-control">
								<option value="" disabled selected>Select your category</option>
								@foreach( $data['categories'] as $category )
									<option value="{{ $category->id }}">{{ $category->name }}</option>
								@endforeach
							</select>
						</label>
						<label>Subcategory
							<select name='subcategory_id' class="form-control">
								<option value="" disabled selected>Select your subcategory</option>
								@foreach( $data['subcategories'] as $subcategory )
									<option data-category-id="{{ $subcategory->fk_dst_cat_id }}" value="{{ $subcategory->id }}">{{ $subcategory->name }}</option>
								@endforeach
							</select>
						</label>
						<div>
							<label>Tags
								{!! Form::text('new_dataset_tags', '', array('class' => 'form-control ', 'placeholder' => 'Enter tags separated by comma' )); !!}
							</label>
						</div>
					</div>
			</section>
			<section class="form-section variable-type-section">
					<div class="form-section-header">
						<h3><span class="form-section-digit">6</span>Select variable type</h3>
					</div>
					<div class="form-section-content">
						<p class="form-section-desc">Choosing right type of variable will help us to determin for which properties in chart it can be used. This will probably be semi-automated in future.</p>
						<select name='variable_type' class="form-control">
							<option value="" disabled selected>Select variable type</option>
							@foreach( $data['varTypes'] as $varType )
								<option value="{{ $varType->id }}">{{ $varType->name }}</option>
							@endforeach
						</select>
					</div>
			</section>
			{!! Form::hidden('data', ''); !!}
			<section class="form-section submit-section">
				{!! Form::submit('Save dataset', array('class' => 'btn btn-success')) !!}
			</section>
		{!! Form::close() !!}
	</div>
@endsection

@section('scripts')
	<script src="{{ asset('js/app/views/App.Views.ImportView.js') }}"></script>
@endsection