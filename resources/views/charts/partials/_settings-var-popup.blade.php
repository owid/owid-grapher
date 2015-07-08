<div class="settings-var-popup">	
	<div class="modal">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
					<h4 class="modal-title">Settings for this variable</h4>
				</div>
				<div class="modal-body">
					<div class="form-variable-select-wrapper">
						<div class="settings-var-header">
							<label class="">
								<input type="radio" name="period" value="single" checked/>
								Display values for single year
							</label>
							<label class="">
								<input type="radio" name="period" value="all" />
								Display values for entire period
							</label>
						</div>
						<div class="settings-var-content">
							<div class="settings-var-content-single">
								<div class="settings-var-content-single-header">
									<label class="">
										<input type="radio" name="single" value="specific" checked/>
										Select specific year
									</label>
									<label class="">
										<input type="radio" name="single" value="latest" />
										Select latest available data
									</label>
								</div>
								<div class="settings-var-content-single-content">
									<div class="settings-var-single-specific-content">
										<label>
											Which year?
											<input type="text" name="single-year" />
										</label>
										<label>
											What tolerance?
											<input type="text" name="single-tolerance" />
										</label>
									</div>
									<div class="settings-var-single-latest-content">
										<label>
											Maximum age of data
											<input type="text" name="single-maximum-age" />
										</label>
									</div>
								</div>
							</div>
							<div class="settings-var-content-all">
								<div class="settings-var-content-all-header">
									<label class="">
										<input type="radio" name="all" value="closest" checked/>
										Select closest available data
									</label>
									<label class="">
										<input type="radio" name="all" value="latest" />
										Select latest available data
									</label>
								</div>
								<div class="settings-var-content-all-content">
									<div class="settings-var-all-closest-content">
										<label>
											What tolerance?
											<input type="text" name="all-tolerance" />
										</label>
									</div>
									<div class="settings-var-all-latest-content">
										<label>
											Maximum age of data
											<input type="text" name="all-maximum-age" />
										</label>
									</div>
								</div>
							</div>							
						</div>
					</div>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-default pull-left" data-dismiss="modal">Cancel</button>
					<button type="button" class="btn btn-primary">Ok</button>
				</div>
			</div><!-- /.modal-content -->
		</div><!-- /.modal-dialog -->
	</div>
</div>