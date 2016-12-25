
<div id="form-view" class="col-sm-12 col-md-6 form-wrapper">
	<div class="form-wrapper-inner">
		{!! Form::open( array( 'method' => $method ) ) !!}
			<div class="nav-tabs-custom">
				<ul class="nav nav-tabs no-bullets">
					<li class="nav-item active">
						<a class="nav-link" href="#basic-tab" data-toggle="tab" aria-expanded="false">Basic</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" href="#data-tab" data-toggle="tab" aria-expanded="false">Data</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" href="#axis-tab" data-toggle="tab" aria-expanded="false">Axis</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" href="#styling-tab" data-toggle="tab" aria-expanded="false">Styling</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" href="#export-tab" data-toggle="tab" aria-expanded="false">Export</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" href="#map-tab" data-toggle="tab" aria-expanded="false">Map</a>
					</li>
				</ul>
			</div>
			<div class="tab-content">
				<div id="basic-tab" class="tab-pane active">
					<section>						
							<h2>Title of the visualization</h2>
						
							<p class="form-section-desc">Never use specific countries or years since these can be changed by the viewer. Instead use <b>*time*</b> or <b>*country*</b> as placeholders. These will be interpreted by the grapher to match what is being looked at.</p>
							<input class="form-control input-lg .col-xs-12" placeholder="Title (shorter is better)" type="text" name="chart-name" value=""/>
							<div class="input-group">
								<span class="input-group-addon">/grapher/</span>
								<input class="form-control .col-xs-12" title="Human-friendly URL slug for this chart" type="text" name="chart-slug" value=""/>
							</div>
					</section>
					<section>						
							<h2>Subtitle of the visualization</h2>
						
							<textarea class="form-control input-lg .col-xs-12" placeholder="Briefly describe the context of the data" type="text" name="chart-subname" value=""></textarea>
					</section>
					<section class="chart-type-section">
						
							<h2>What type of chart</h2>
						
							<select name="chart-type" class="form-control chart-type-select">
								<option value="" disabled selected>Select type</option>
								<option value="LineChart">Line Chart</option>
								<option value="ScatterPlot">Scatter Plot</option>
								<option value="StackedArea">Stacked Area</option>
								<option value="MultiBar">Multi Bar</option>
								<option value="HorizontalMultiBar">Horizontal Multi Bar</option>
								<option value="DiscreteBar">Discrete Bar</option>
							</select>
					</section>
					<section>
						
							<h2>Footer note</h2>
						
							<textarea class="form-control input-lg .col-xs-12" placeholder="Any further relevant information e.g. adjustments or limitations" type="text" name="chart-footer-note" value=""></textarea>
					</section>
					<section>
						
							<h2>Internal author notes</h2>
						
							<textarea class="form-control input-lg .col-xs-12" placeholder="WIP, needs review, etc" type="text" name="chart-notes" value=""></textarea>
					</section>
				</div>
				<div id="data-tab" class="tab-pane">
					<section class="add-data-section">
						
							<h2>Add your data</h2>
						
							<a class="add-data-btn"><i class="fa fa-plus"></i>Add variable</a>
							<div class="dd">
								<div class="dd-empty"></div>
							</div>
						<p class="form-section-desc hidden">Assign variables to the graph dimensions below by dragging them.</p>
					</section>
					<section class="dimensions-section">
	 					<input type="hidden" name="chart-dimensions" value="" />
					</section>
					<section class="entities-section">
						
							<h2>Pick your countries</h2>
						
							<p class="form-section-desc">Select countries from drop down below. You can set country colors by clicking on the country label itself.</p>
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
										User can add and remove countries
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
					</section>
					<section class="time-section">
						
							<h2>Define your time</h2>
						
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
					</section>
				</div>
				<div id="axis-tab" class="tab-pane">
					<section>
						
							<h2>Refine your axis</h2>
						
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
									<label for="chart-y-axis-min">Y-Axis Min</label>
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
					</section>
				</div>
				<div id="styling-tab" class="tab-pane">
                    <section class="logo-section">
                        
                            <h2>Logos</h2>
                        
                            <select name="logo" class="form-control logo-select">
                                <option value="" disabled selected>Select type</option>
                                @foreach($data->logos as $logoName)
                                    <option value="{{ $logoName }}">{{ $logoName }}</option>
                                @endforeach
                            </select>
                    </section>
					<section class="type-of-line-section">
						
							<h2>Choose Type of Line</h2>
						
							<label>
								<input type="radio" name="line-type" value="0"/>
								Line with dots
							</label>
							<label>
								<input type="radio" name="line-type" value="1"/>
								Line without dots
							</label>
							{{-- <label>
								<input type="radio" name="line-type" value="2"/>
								Do not join values if observations are missing
							</label> --}}
							<label>
								<input type="radio" name="line-type" value="3"/>
								Dotted with dashed line for missing observations
							</label>
							<br>
							<label style="display: none;">
								Maximum year gap to tolerate
								<input type="input" class="form-control" name="line-tolerance" value=""/>
							</label>
					</section>
					<section class="legend-section">
						
							<h2>Legend</h2>
						
							<label class="clickable">
								<input type="checkbox" name="hide-legend" />
								Hide legend
							</label><br>
							<label class="clickable">
								<input type="checkbox" name="hide-toggle" />
								Hide absolute/relative toggle
							</label><br>
							<label>
								<span>Type of entity shown</span>
								<input type="input" class="form-control" name="entity-type" value=""/>
							</label>
					</section>
					<section class="units-section">
						
							<h2>Popup Units</h2>
						
					</section>
				</div>
				<div id="export-tab" class="tab-pane">
					<section class="tabs-section">
						
							<h2>Which tabs</h2>
						
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
					</section>
					<section>
						<header class="embed-section">
							<h2>Embed your chart</h2>
						</header>
							<p class="form-section-desc">Copy and paste code below to use the chart on your page.</p>
							<textarea rows="4" cols="50" name="iframe" @if (isset($chart)) data-view-url="{!! route( 'view', $chart->id ) !!}" @endif placeholder="No chart created, yet. Click 'Create chart' button at the bottom to get code for embedding." readonly></textarea>
					</section>
				</div>
				<div id="map-tab" class="tab-pane">
					<section class="map-variable-section">
						
							<h2>Which variable on map</h2>
						
							<select name="map-variable-id" class="form-control"><select>
					</section>
					<section class="map-timeline-section">
						
							<h2>Timeline</h2>
						
							<label>
								<i class="fa fa-info-circle" data-toggle="tooltip" title="Specify a range of years from which to pull data. For example, if the map shows 1990 and tolerance is set to 1, then data from 1989 or 1991 will be shown if no data is available for 1990."></i>
								Tolerance of data:
								<input name="map-time-tolerance" class="form-control" placeholder="Tolerance of data" />
							</label>
							<div class="form-group">
								<i class="fa fa-info-circle" data-toggle="tooltip" title="Various ranges can be specified. For example: <br>&quot;1990 to 2000 every 5; 2003; 2009&quot;<br>Will show the years 1990, 1995, 2000, 2003 and 2009."></i>&nbsp;<label>Years to show:</label>
								<input name="map-time-ranges" class="form-control" data-toggle="tooltip" placeholder="first to last every 1" />
							</div>
							<label>
								Default year to show:
								<select name="map-default-year" class="form-control"></select>
							</label>
					</section>
					<section class="map-colors-section">
						
							<h2>Colors</h2>
						
							<label>
								<a href="http://www.datavis.ca/sasmac/brewerpal.html" title="Color brewer schemes" target="_blank"><i class="fa fa-info-circle"></i></a> Color scheme:
								<select name="map-color-scheme" class="form-control"></select>
							</label>
							<label>
								Number of intervals:
								<input name="map-color-interval" type="number" class="form-control" min="0" max="99" />
							</label>
							<label>
								<input name="map-color-invert" type="checkbox"/>
								Invert colors
							</label>
							<label>
								<input name="map-color-automatic-classification" type="checkbox" checked/>
								Automatically classify data
							</label>
							<ul class="map-color-scheme-preview clearfix automatic-values">

							</ul>
					</section>
					<section class="map-regions-section">
						
							<h2>Displayed map section</h2>
						
							<label>
								Which region map should be focused on:
								<select name="map-default-projection" class="form-control"></select>
							</label>
					</section>
					<section class="map-legend-section">
						
							<h2>Legend</h2>
						
<!--							<label>
								Legend orientation:
								<select name="map-legend-orientation" class="form-control">
									<option value="landscape">Landscape</option>
									<option value="portrait">Portrait</option>
								</select>
							</label>-->
							<label>
								Legend description:
								<input type="text" name="map-legend-description" class="form-control" />
							</label>
					</section>
				</div>
			</div>
			<section class="form-section-submit">
				<button id="save-chart" type="submit" class="btn btn-lg btn-success btn-primary">{{ $submitLabel }}</button>
				@if ($submitLabel == "Update chart")
					<button id="save-as-new" class="btn btn-lg btn-primary">Save as new</button>
					<button id="publish-toggle" class="btn btn-lg btn-danger">Publish</button>
				@endif
			</section>
		{!! Form::close() !!}
	</div>
</div>
