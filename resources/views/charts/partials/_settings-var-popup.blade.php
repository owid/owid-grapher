<form class="settings-var-popup">	
	<div class="modal">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
					<h4 class="modal-title">Settings for this variable</h4>
				</div>
				<div class="modal-body">
					<div class="form-variable-select-wrapper">
						<div class="settings-var-name">
							<div class="input-wrapper">
								<label for="display-name">Display Name</label>
								<input class="form-control" type="text" name="display-name" style="width: 100%;"/>																
							</div>
						</div>
						<br>
						<div class="advanced-settings">
							<label>
								<span>Tolerance</span>
								<input type="text" class="form-control digit-input" name="tolerance" />
							</label>
						</div>
					</div>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-default pull-left" data-dismiss="modal">Cancel</button>
					<input type="submit" class="btn btn-primary" value="Save">
				</div>
			</div><!-- /.modal-content -->
		</div><!-- /.modal-dialog -->
	</div>
</form>