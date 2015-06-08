<div class="select-var-popup">	
	<div class="modal">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
					<h4 class="modal-title">Select dataset from database</h4>
				</div>
				<div class="modal-body">
					<div class="form-variable-select-wrapper">
						<label class="category-wrapper">
							Category:
							<select name='category-id' class="form-control">
								<option value="" disabled selected>Select dataset category</option>
								@foreach( $data->categories as $category )
									<option value="{{ $category->id }}">{{ $category->name }}</option>
								@endforeach
							</select>
						</label>
						<label class="subcategory-wrapper">
							Subcategory:
							<select name='subcategory-id' class="form-control">
								<option value="" disabled selected>Select your subcategory</option>
								@foreach( $data->subcategories as $subcategory )
									<option data-category-id="{{ $subcategory->fk_dst_cat_id }}" value="{{ $subcategory->id }}">{{ $subcategory->name }}</option>
								@endforeach
							</select>
						</label>
						<label class="variable-wrapper">
							Variable:
							<select name='chart-variable' class="form-control form-variable-select">
								<option value="" disabled selected>Select your variable</option>
								@foreach( $data->variables as $variable )
									<option data-subcategory-id="{{ $variable->dataset->fk_dst_subcat_id }}" value="{{ $variable->id }}">{{ $variable->name }}</option>
								@endforeach
							</select>
						</label>
					</div>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-default pull-left" data-dismiss="modal">Close</button>
					<button type="button" class="btn btn-primary">Add variable</button>
				</div>
			</div><!-- /.modal-content -->
		</div><!-- /.modal-dialog -->
	</div>
</div>