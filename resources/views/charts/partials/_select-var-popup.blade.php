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
						<label class="variable-wrapper">
							Database:
							<select name='database' class='form-control'>
								<option value="owid" selected>OWID</option>
								<option value="qog">QoG Standard</option>
							</select>
						</label>
						<label class="variable-wrapper">
							Variable:
							<select name='chart-variable' data-placeholder="Select your variable" class="form-control form-variable-select chosen-select">
								@foreach ($data->optgroups as $optgroup)
									<optgroup label="{{ $optgroup->name }}">
										@foreach ($optgroup->variables as $variable)
											<option data-namespace="{{ $optgroup->namespace }}" data-unit="{{ $variable->unit }}" value="{{ $variable->id }}">{{ $variable->name }}</option>
										@endforeach
									</optgroup>
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