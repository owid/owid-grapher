@extends('app')

@section('styles')
	{!! Rapyd::styles() !!} 
@endsection

@section('content')
	<div class="module-wrapper index-variable-module">
		<a class="back-btn" href="{{ route( 'datasets.show', $variable->fk_dst_id ) }}"><i class="fa fa-arrow-left"></i>Back to the dataset</a>
		<div class="pull-right right-btns-wrapper clearfix">
			<a href="{{ route( 'variables.edit', $variable->id) }}"><i class="fa fa-pencil"></i> Edit variable</a>
			{!! Form::open(array('class' => 'form-inline', 'method' => 'DELETE', 'route' => array('variables.destroy', $variable->id))) !!}
				<button class="delete-btn" type="submit"><i class="fa fa-remove"></i> Delete variable</button>
			{!! Form::close() !!}
		</div>
		<h2>{{ $variable->name }}</h2>
		<div class="property-wrapper">
			<h3 class="property-title">Unit</h3>
			<div class="property-value">
				{{ $variable->unit }}
			</div>
		</div>
		<div class="property-wrapper">
			<h3 class="property-title">Description</h3>
			<div class="property-value">
				{{ $variable->description }}
			</div>
		</div>
		<div class="property-wrapper">
			<h3 class="property-title">Source</h3>
			<div class="property-value">
				@if ( $variable->datasource )
					{!! Html::link('/datasources/' .$variable->datasource->id, $variable->datasource->name ) !!}
				@endif
			</div>
		</div>
		<div class="property-wrapper">
			<h3 class="property-title">Data</h3>
			<div class="property-value">
				{!! $filter !!} 
				<div class="pull-right">
					{!! Form::open(array('class' => 'form-inline', 'method' => 'DELETE', 'route' => array('valuesBatchDestroy'))) !!}
						<input type="hidden" name="value_ids" value=""/>
						<button type="submit" class="delete-btn"><i class="fa fa-remove"></i>Delete displayed values</a>
					{!! Form::close() !!}
					<a href="{!! $exportUrl !!}">Export to CSV</a>
				</div>

				{!! $grid !!}

			</div>

		</div>
	</div>
@endsection

@section('scripts')
	{!! Rapyd::scripts() !!} 
@endsection