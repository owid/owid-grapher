
<div id="form-view" class="col-sm-12 col-md-6 form-wrapper">

	<a href="#" class="form-collapse-btn"><i class="fa fa-caret-right"></i><span class="visuallyhidden">Collapse btn</span></a>
	<div class="form-wrapper-inner">
		{!! Form::open( array( 'method' => $method ) ) !!}
			<div class="nav-tabs-custom">
				<ul class="nav nav-tabs no-bullets">
					<li class="active">
						<a href="#basic-tab" data-toggle="tab" aria-expanded="false">1. Basic</a>
					</li>
					<li>
						<a href="#data-tab" data-toggle="tab" aria-expanded="false">2. Data</a>
					</li>
					<li>
						<a href="#axis-tab" data-toggle="tab" aria-expanded="false">3. Axis</a>
					</li>
					<li>
						<a href="#styling-tab" data-toggle="tab" aria-expanded="false">4. Styling</a>
					</li>
					<li>
						<a href="#export-tab" data-toggle="tab" aria-expanded="false">5. Export</a>
					</li>
					<li>
						<a href="#map-tab" data-toggle="tab" aria-expanded="false">6. Map</a>
					</li>
				</ul>
			</div>
			<div class="tab-content">
				<div id="basic-tab" class="tab-pane active">
					<section class="form-section">
						<div class="form-section-header">
							<h2><span class="form-section-digit">a</span>Name your chart.</h2>
						</div>
						<div class="form-section-content">
							<p class="form-section-desc">This will be shown as the title of the chart.</p>
							<input class="form-control input-lg .col-xs-12" placeholder="Chart name" type="text" name="chart-name" value=""/>
						</div>
					</section>
					<section class="form-section">
						<div class="form-section-header">
							<h2><span class="form-section-digit">b</span>Describe your chart</h2>
						</div>
						<div class="form-section-content">
							<textarea class="form-control input-lg .col-xs-12" placeholder="Chart subname" type="text" name="chart-subname" value=""></textarea>
						</div>
					</section>
					<section class="form-section chart-type-section">
						<div class="form-section-header">
							<h2><span class="form-section-digit">c</span>What type of chart</h2>
						</div>
						<div class="form-section-content">
							<select name="chart-type" class="form-control chart-type-select">
								<option value="" disabled selected>Select type</option>
								@foreach( $data->chartTypes as $chartTypeId=>$chartTypeName )
									<option value="{{ $chartTypeId }}">{{ $chartTypeName }}</option>
								@endforeach
							</select>
						</div>
					</section>
				</div>
				<div id="data-tab" class="tab-pane">
					<section class="form-section add-data-section">
						<div class="form-section-header">
							<h2><span class="form-section-digit">d</span>Add your data</h2>
						</div>
						<div class="form-section-content">
							<a href="#" class="add-data-btn"><i class="fa fa-plus"></i>Add variable</a>
							<div class="dd">
								<ol class="dd-list">

								</ol>
							</div>
						<p class="form-section-desc hidden">Assign variables to the graph dimensions below by dragging them.</p>
						</div>
						<!--<div class="form-section-content">
							<p class="form-section-desc">Or choose CSV file from your computer with data to chart. Each country data should be in their own colum,time should it be first column, otherwise it's not gonna work.</p>
							<div class="file-picker-wrapper">
								<input type="file" />
								<a href="#" title="Remove uploaded file" class="remove-uploaded-file-btn"><span class="visuallyhidden">Remove uploaded file</span><i class="fa fa-remove"></i></a>
							</div>
						</div>-->
					</section>
					<section class="form-section dimensions-section">
						<div class="form-section-content">
							
						</div>
						<div class="group-by-variable-wrapper">
							<label>
								<input type="checkbox" name="group-by-variable" />
								Group by variables
							</label>
						</div>
	 					<input type="hidden" name="chart-dimensions" value="" />
					</section>
					<section class="form-section">
						<div class="form-section-header">
							<h2><span class="form-section-digit">e</span>Additional data source explanation to be shown in the footer</h2>
						</div>
						<div class="form-section-content">
							<textarea name="description" placeholder="Enter all the sources information"></textarea>
						</div>
					</section>
					<section class="form-section entities-section">
						<div class="form-section-header">
							<h2><span class="form-section-digit">f</span>Pick your countries</h2>
						</div>
						<div class="form-section-content">
							<p class="form-section-desc">Select countries from drop down below. You can set countries colors by clicking on the country label itself.</p>
							<ul class="selected-countries-box no-bullets">

							</ul>
							<select class="form-control countries-select" data-placeholder="Choose a Country...">
								<option value=""></option>
							</select>
							<div class="add-country-control-wrapper">
								<h4>Can user add/change countries?</h4>
								<radiogroup>
									<label>
										<input type="radio" name="add-country-mode" value="add-country" checked></input>
										User can add countries
									</label>
									<label>
										<input type="radio" name="add-country-mode" value="change-country" selected></input>
										User can change country
									</label>
									<label>
										<input type="radio" name="add-country-mode" value="disabled" selected></input>
										User cannot change/add country
									</label>
								</radiogroup>
							</div>
						</div>
					</section>
					<section class="form-section time-section">
						<div class="form-section-header">
							<h2><span class="form-section-digit">g</span>Define your time</h2>
						</div>
						<div class="form-section-content">
							<label>
								<input type="checkbox" name="dynamic-time" checked/>
								Use entire time period of the selected data
							</label>
							<input type="text" name="chart-time" value=""/>
							<div class="chart-time-inputs-wrapper">
								<label>
									Time from:
									<input type="text" name="chart-time-from" class="form-control" value="" />
								</label>
								<label>
									Time to:
									<input type="text" name="chart-time-to" class="form-control" value="" />
								</label>
							</div>
						</div>
					</section>
				</div>
				<div id="axis-tab" class="tab-pane">
					<section class="form-section">
						<div class="form-section-header">
							<h2><span class="form-section-digit">h</span>Refine your axis</h2>
						</div>
						<div class="form-section-content">
							<div class="y-section">
								<h3>Y Axis</h3>
								<div class="input-wrapper">
									<label for="chart-y-axis-label">Y-Axis Label</label>
									<input class="form-control" type="text" name="chart-y-axis-label" />
								</div>
								<div class="input-wrapper">
									<label for="chart-y-label-distance">Y-Axis Label Distance</label>
									<input class="form-control" type="text" name="chart-y-axis-label-distance" />
								</div>
								<div class="input-wrapper">
									<label for="chart-y-axis-max">Y-Axis Max</label>
									<input class="form-control" type="text" name="chart-y-axis-max" />
								</div>
								<div class="input-wrapper">
									<label for="chart-y-axis-min">Y-Axis Min (0 is default)</label>
									<input class="form-control" type="text" name="chart-y-axis-min" />
								</div>
								<div class="input-wrapper">
									<label for="chart-y-axis-prefix">Y-Axis Prefix</label>
									<input class="form-control" type="text" name="chart-y-axis-prefix" />
								</div>
								<div class="input-wrapper">
									<label for="chart-y-axis-suffix">Y-Axis Suffix</label>
									<input class="form-control" type="text" name="chart-y-axis-suffix" />
								</div>
								<div class="input-wrapper">
									<label for="chart-y-axis-format">Y-Axis No of decimal places</label>
									<input class="form-control" type="text" name="chart-y-axis-format" />
								</div>
								<div class="input-wrapper">
									<label for="chart-y-scale">Y-Axis Scale</label>
									<select class="form-control" type="text" name="chart-y-axis-scale">
										<option value="linear">Linear</option>
										<option value="log">Log</option>
									</select>
								</div>
								<div class="input-wrapper axis-scale-selector-wrapper">
									<label for="y-axis-scale-selector">
										<input type="checkbox" name="y-axis-scale-selector" />
										User can select Y axis scale
									</label>
								</div>
							</div>
							<div class="x-section">
								<h3>X Axis</h3>
								<div class="input-wrapper">
									<label for="chart-x-axis-label">X-Axis Label</label>
									<input class="form-control" type="text" name="chart-x-axis-label" />
								</div>
								<div class="input-wrapper">
									<label for="chart-x-label-distance">X-Axis Label Distance</label>
									<input class="form-control" type="text" name="chart-x-axis-label-distance" />
								</div>
								<div class="input-wrapper">
									<label for="chart-x-axis-max">X-Axis Max</label>
									<input class="form-control" type="text" name="chart-x-axis-max" />
								</div>
								<div class="input-wrapper">
									<label for="chart-x-axis-min">X-Axis Min</label>
									<input class="form-control" type="text" name="chart-x-axis-min" />
								</div>
								<div class="input-wrapper">
									<label for="chart-x-axis-prefix">X-Axis Prefix</label>
									<input class="form-control" type="text" name="chart-x-axis-prefix" />
								</div>
								<div class="input-wrapper">
									<label for="chart-x-axis-suffix">X-Axis Suffix</label>
									<input class="form-control" type="text" name="chart-x-axis-suffix" />
								</div>
								<div class="input-wrapper">
									<label for="chart-x-axis-format">X-Axis No of decimal places</label>
									<input class="form-control" type="text" name="chart-x-axis-format" />
								</div>
								<div class="input-wrapper">
									<label for="chart-y-scale">X-Axis Scale</label>
									<select class="form-control" type="text" name="chart-x-axis-scale">
										<option value="linear">Linear</option>
										<option value="log">Log</option>
									</select>
								</div>
								<div class="input-wrapper axis-scale-selector-wrapper">
									<label for="x-axis-scale-selector">
										<input type="checkbox" name="x-axis-scale-selector" />
										User can select X axis scale
									</label>
								</div>
							</div>
						</div>
					</section>
				</div>
				<div id="styling-tab" class="tab-pane">
					<section class="form-section logo-section">
						<div class="form-section-header">
							<h2><span class="form-section-digit">i</span>Logo</h2>
						</div>
						<div class="form-section-content">
							<select name="logo" class="form-control logo-select">
								<option value="" disabled selected>Select type</option>
								@foreach( $data->logos as $logoId=>$logoName )
									<option value="{{ $logoId }}">{{ $logoName }}</option>
								@endforeach
							</select>
						</div>
					</section>
					<section class="form-section type-of-line-section">
						<div class="form-section-header">
							<h2><span class="form-section-digit">j</span>Choose Type of Line</h2>
						</div>
						<div class="form-section-content">
							<label>
								<input type="radio" name="line-type" value="0"/>
								Line with dots
							</label>
							<label>
								<input type="radio" name="line-type" value="1"/>
								Line without dots
							</label>
							<label>
								<input type="radio" name="line-type" value="2"/>
								Do not join values if observations are missing
							</label>
						</div>
					</section>
					<section class="form-section margins-section">
						<div class="form-section-header">
							<h2><span class="form-section-digit">k</span>Set margins</h2>
						</div>
						<div class="form-section-content">
							<label>
								<span>Margin top</span>
								<input type="input" class="form-control" name="margin-top" value=""/>
							</label>
							<label>
								<span>Margin right</span>
								<input type="input" class="form-control" name="margin-right" value=""/>
							</label>
							<label>
								<span>Margin bottom</span>
								<input type="input" class="form-control" name="margin-bottom" value=""/>
							</label>
							<label>
								<span>Margin left</span>
								<input type="input" class="form-control" name="margin-left" value=""/>
							</label>
						</div>
					</section>
					<section class="form-section legend-section">
						<div class="form-section-header">
							<h2><span class="form-section-digit">l</span>Legend</h2>
						</div>
						<div class="form-section-content">
							<label>
								<input type="checkbox" name="hide-legend" />
								Hide legend
							</label>
						</div>
					</section>
					<section class="form-section units-section">
						<div class="form-section-header">
							<h2><span class="form-section-digit">m</span>Popup Units</h2>
						</div>
						<div class="form-section-content">
						</div>
					</section>
				</div>
				<div id="export-tab" class="tab-pane">
					<section class="form-section tabs-section">
						<div class="form-section-header">
							<h2><span class="form-section-digit">n</span>Which tabs</h2>
						</div>
						<div class="form-section-content">
							<ol>
								<li>
									<label class="chart-tab-check">
										<input type="checkbox" value="chart" />
										Chart tab
									</label>
								</li>	
								<li>
									<label class="data-tab-check">
										<input type="checkbox" value="data" />
										Data tab
									</label>
								</li>
								<li>
									<label class="map-tab-check">
										<input type="checkbox" value="map" />
										Map tab
									</label>
								</li>
								<li>
									<label class="sources-tab-check">
										<input type="checkbox" value="sources" />
										Sources tab
									</label>
								</li>
							</ol>
							<label>
								<span>Open by default:</span>
								<select type="text" name="default-tab" class="form-control">
									<option value="chart">Chart tab</option>
									<option value="data">Data tab</option>
									<option value="map">Map tab</option>
									<option value="sources">Sources tab</option>
								</select>
							</label>
						</div>
					</section>
					<section class="form-section">
						<div class="form-section-header embed-section">
							<h2><span class="form-section-digit">o</span>Embed your chart</h2>
						</div>
						<div class="form-section-content">
							<div class="embed-size-wrapper">
								<label>
									<span>Width</span>
									<input type="text" name="iframe-width" class="form-control" />
								</label>
								<label>
									<span>Height</span>
									<input type="text" name="iframe-height" class="form-control" />
								</label>
							</div>
							<p class="form-section-desc">Copy and paste code below to use the chart on your page.</p>
							<textarea rows="4" cols="50" name="iframe" @if (isset($chart)) data-view-url="{!! route( 'view', $chart->id ) !!}" @endif placeholder="No chart created, yet. Click 'Create chart' button at the bottom to get code for embedding." readonly></textarea>
						</div>
					</section>
				</div>
				<div id="map-tab" class="tab-pane">
					<section class="form-section map-variable-section">
						<div class="form-section-header">
							<h2><span class="form-section-digit">p</span>Which variable on map</h2>
						</div>
						<div class="form-section-content">
							<select name="map-variable-id" class="form-control">
							<select>
						</div>
					</section>
					<section class="form-section map-timeline-section">
						<div class="form-section-header">
							<h2><span class="form-section-digit">q</span>Timeline</h2>
						</div>
						<div class="form-section-content">
							<label>
								Tolerance of data:
								<input name="map-time-tolerance" class="form-control" placeholder="Tolerance of data" />
							</label>
							<label>
								Switch between years, using:
								<select name="map-time-mode" class="form-control">
									<option value="slider">Slider</option>
									<option value="buttons">Buttons</option>
								</select>
							</label>
							<div class="form-group">
								<i class="fa fa-info-circle" data-toggle="tooltip" title="Various ranges can be specified. For example: <br>&quot;1990 to 2000 every 5; 2003; 2009&quot;<br>Will show the years 1990, 1995, 2000, 2003 and 2009."></i>							
								<label>Years to show:</label>
								<input name="map-time-ranges" class="form-control" data-toggle="tooltip" placeholder="first to last every 1" />
							</div>
							<label>
								Default year to show:
								<select name="map-target-year" class="form-control"></select>
							</label>
						</div>
					</section>
					<section class="form-section map-colors-section">
						<div class="form-section-header">
							<h2><span class="form-section-digit">r</span>Colors</h2>
						</div>
						<div class="form-section-content">
							<label>
								<a href="http://www.datavis.ca/sasmac/brewerpal.html" title="Color brewer schemes" target="_blank"><i class="fa fa-info-circle"></i></a> Color scheme:
								<select name="map-color-scheme" class="form-control"></select>
							</label>
							<label>
								Number of intervals:
								<input name="map-color-interval" type="number" class="form-control" />
							</label>
							<label>
								<input name="map-color-automatic-classification" type="checkbox" checked/>
								Automatically classify data
							</label>
							<ul class="map-color-scheme-preview clearfix automatic-values">

							</ul>
						</div>
					</section>
					<section class="form-section map-regions-section">
						<div class="form-section-header">
							<h2><span class="form-section-digit">s</span>Displayed map section</h2>
						</div>
						<div class="form-section-content">
							<label>
								Which region map should be focused on:
								<select name="map-projections" class="form-control"></select>
							</label>
						</div>
					</section>
					<section class="form-section map-legend-section">
						<div class="form-section-header">
							<h2><span class="form-section-digit">t</span>Legend</h2>
						</div>
						<div class="form-section-content">
							<label>
								Legend orientation:
								<select name="map-legend-orientation" class="form-control">
									<option value="landscape">Landscape</option>
									<option value="portrait">Portrait</option>
								</select>
							</label>
							<label>
								Legend description:
								<input type="text" name="map-legend-description" class="form-control" />
							</label>
							<label>
								Legend square size:
								<input type="number" name="map-legend-step-size" class="form-control" min="5" max="100" step="1" />
							</label>
						</div>
					</section>
				</div>
			</div>
			<section class="form-section form-section-submit">
				<button type="submit" class="btn btn-lg btn-success btn-primary">{{ $submitLabel }}</button>
			</section>
		{!! Form::close() !!}
	</div>
</div>
