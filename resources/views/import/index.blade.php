@extends('app')

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
		{!! Form::open(array('class' => 'form-inline validate-form', 'method' => 'post', 'url' => 'import/store')) !!}
			<input name="user_id" class="" type="hidden" value="{!! \Auth::user()->id !!}" />
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
							{!! Form::text('new_dataset_name', '', array('class' => 'form-control required', 'placeholder' => 'Short name for your dataset' )); !!}
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
							<label class="existing-variable-wrapper">
								Insert data into new variable or select existing one.
								<select name='existing_variable_id' class="form-control">
									<option value="" selected>Create new variable</option>
									@foreach( $data['variables'] as $variable )
										<option data-id="{{ $variable->id }}" data-dataset-id="{{ $variable->fk_dst_id }}" data-name="{{ $variable->name }}" data-unit="{{ $variable->unit }}" data-description="{{ $variable->description }}" value="{{ $variable->id }}">{{ $variable->name }}</option>
									@endforeach
								</select>
							</label>
						</div>
					</div>
			</section>
			<section class="form-section dataset-type-section">
					<div class="form-section-header">
						<h3><span class="form-section-digit">2</span>Dataset type</h3>
					</div>
					<div class="form-section-content">
						<p class="form-section-desc">Do you have multiple variables in your dataset? Please note that all variables have to come from the same source, and first column has to be country name.</p>
						<fieldset class="dataset-type-radiogroup">
							<label><input type="radio" class="" name="multivariant_dataset" value="0" checked/> Single variable in dataset</label>
							<label><input type="radio" class="" name="multivariant_dataset" value="1" /> Multiple variables in dataset</label>
						</fieldset>
					</div>
			</section>
			<section class="form-section upload-section">
					<div class="form-section-header">
						<h3><span class="form-section-digit">3</span>Upload file with data</h3>
					</div>
					<div class="form-section-content">
						<p class="form-section-desc">For now, just CSV files are working. We'll have xls and choice of external source (e.g. Gapminder) in the future.</p>
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
						<h3><span class="form-section-digit">4</span>Check Variables</h3>
					</div>
					<div class="form-section-content">
						<p class="form-section-desc">Here you can check which variables will be stored for your dataset. Names for variable are either taken from dataset name, if you have just one variable, or from name of the columns in uploaded data, if you have more variables. For each variable you can optionally add unit and its description. If you think that's usefull.</p>
						<ol></ol>
					</div>
			</section>
			<section class="form-section datasources-section">
					<div class="form-section-header">
						<h3><span class="form-section-digit">5</span>Set source</h3>
					</div>
					<div class="form-section-content">
						<p class="form-section-desc">Please enter all the sources that were used in creating the data set – like: "World Bank, UN IGME, Atkinson and Morelli (2013), ...</p>
						<!--<select name='datasource_id' class="form-control">
							<option value="" selected>Create new datasources</option>
							@foreach( $data['datasources'] as $datasource )
								<option data-datasource-id="{{ $datasource->id }}" value="{{ $datasource->id }}">{{ $datasource->name }}</option>
							@endforeach
						</select>-->
						<div class="new-datasource-wrapper">
							<label>
								<span>Source name:</span>
								<input class="form-control required" type="text" name="source_name" />
							</label>
							<!--<label>
								<span>Source link:</span>
								<input class="form-control required" type="text" name="source_link" />
							</label>-->
							<label>
								<span>Source description:</span>
								<textarea cols="75" rows="18" class="form-control datasource-editor required" type="text" name="source_description">@include('import/partials/_sources-default')</textarea>
								<span class="sources-default" style="display:none;"></span>
							</label>

						</div>
					</div>
			</section>
			<section class="form-section category-section">
					<div class="form-section-header">
						<h3><span class="form-section-digit">6</span>Select category</h3>
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
							<label>Source Tags
								{!! Form::text('new_dataset_tags', '', array('class' => 'form-control ', 'placeholder' => 'Enter tags separated by comma' )); !!}
							</label>
						</div>
					</div>
			</section>
			<section class="form-section variable-type-section">
					<div class="form-section-header">
						<h3><span class="form-section-digit">7</span>Select variable type</h3>
					</div>
					<div class="form-section-content">
						<p class="form-section-desc">Choosing right type of variable will help us to determin for which properties in chart it can be used. This will probably be semi-automated in future.</p>
						<select name='variable_type' class="form-control">
							<option value="" disabled>Select variable type</option>
							@foreach( $data['varTypes'] as $varType )
								<option value="{{ $varType->id }}" @if($varType->id == 2) {{'selected'}}@endif>{{ $varType->name }}</option>
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

@section('outter-content')
	@include('import/partials/_import-progress-popup')
@endsection

@section('scripts')
	<!--<script src="{{ asset('js/libs/papaparse.js') }}?bust={!!time()!!}"></script>
	<script src="{{ asset('js/libs/moments.min.js') }}?bust={!!time()!!}"></script>
	<script src="{{ asset('js/app/models/import/App.Models.Import.InputFileModel.js') }}?bust={!!time()!!}"></script>
	<script src="{{ asset('js/app/models/import/App.Models.Import.DatasourceModel.js') }}?bust={!!time()!!}"></script>
	<script src="{{ asset('js/app/models/import/App.Models.Import.DatasetModel.js') }}?bust={!!time()!!}"></script>
	<script src="{{ asset('js/app/models/import/App.Models.Import.VariableModel.js') }}?bust={!!time()!!}"></script>
	<script src="{{ asset('js/app/models/import/App.Models.Import.EntityModel.js') }}?bust={!!time()!!}"></script>
	<script src="{{ asset('js/app/views/ui/App.Views.UI.ImportProgressPopup.js') }}?bust={!!time()!!}"></script>
	<script src="{{ asset('js/app/models/App.Models.Importer.js') }}?bust={!!time()!!}"></script>
	<script src="{{ asset('js/app/views/App.Views.ImportView.js') }}?bust={!!time()!!}"></script>-->
	<script src="{{ asset('js/ImportApp.js') }}?bust={!!time()!!}"></script>
@endsection