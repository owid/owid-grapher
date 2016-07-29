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
		<h2>Import <a class="clear-settings-btn" style="display: none;">Clear Settings</a></h2>
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
							{{-- <label class="existing-variable-wrapper">
								Insert data into new variable or select existing one.
								<select name='existing_variable_id' class="form-control">
									<option value="" selected>Create new variable</option>
									@foreach( $data['variables'] as $variable )
										<option data-id="{{ $variable->id }}" data-dataset-id="{{ $variable->fk_dst_id }}" data-name="{{ $variable->name }}" data-unit="{{ $variable->unit }}" data-description="{{ $variable->description }}" value="{{ $variable->id }}">{{ $variable->name }}</option>
									@endforeach
								</select>
							</label> --}}
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
						<p class="form-section-desc">CSV file is preferred. Examples of valid row layouts: <a href="http://ourworldindata.org/wp-content/uploads/2016/02/ourworldindata_single-var.png">single variable</a>, <a href="http://ourworldindata.org/wp-content/uploads/2016/02/ourworldindata_multi-var.png">multiple variables</a>.
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
						<p class="form-section-desc">Here you can check which variables will be stored for your dataset. Names for variables are either taken from dataset name, if you have just one variable, or from names of the columns in uploaded data, if you have more variables. For each variable you can optionally add a unit and its description. If you think that's useful.</p>
						<ol></ol>
					</div>
			</section>

			<section class="form-section category-section">
					<div class="form-section-header">
						<h3><span class="form-section-digit">6</span>Select category</h3>
					</div>
					<div class="form-section-content">
						<p class="form-section-desc">Select an appropriate category for the dataset. </p>
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
					<select class="source"></select>
					<label>
						<span>Source name:</span>
						<p class="form-section-desc">This name will be shown in the visualization footer.</p>
						<input class="form-control required" type="text" name="source_name" />
					</label>
					<label>
						<span>Source description:</span>
						<textarea class="form-control source-editor required" type="text" name="source_description"></textarea>
						<span class="sources-default" style="display:none;">{!! $data['sourceTemplate']->meta_value !!}</span>
					</label>				
				</div>
				<div class="modal-footer">
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
@endsection