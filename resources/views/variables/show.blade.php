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
			<h3 class="property-title">Data</h3>
			<div class="property-value">
				{!! $filter !!} 
				<div class="pull-right">
					<a href="{!! $exportUrl !!}">Export to CSV</a>
				</div>
				{!! $grid !!}
				<!--<table class="values-table">
					<tr><th>Value</th><th>Entity</th><th>Time</th></tr>
					@foreach( $values as $value )
						<tr>
							<td>{{ $value->value }}</td>
							<td>{{ $value->name }}</td>
							<td>{{ $value->label }}</td>
							<td><a href="{{ route( 'values.edit', $value->id) }}"><i class="fa fa-pencil"></i> Edit</a></td>
							<td> 
								{!! Form::open(array('class' => 'form-inline', 'method' => 'DELETE', 'route' => array('values.destroy', $value->id))) !!}
									<button class="delete-btn" type="submit"><i class="fa fa-remove"></i> Delete</button>
								{!! Form::close() !!}
						   </td>
						</tr>
					@endforeach
				</table>-->
			</div>

		</div>
	</div>
@endsection

@section('scripts')
	{!! Rapyd::scripts() !!} 
@endsection