@extends('app')

@section('content')
	<div class="module-wrapper show-datasource-module">
		<a class="back-btn" href="{!! route( 'datasources.index' ) !!}"><i class="fa fa-arrow-left"></i>Back to the list of sources</a>
		<div class="pull-right right-btns-wrapper clearfix">
			<a href="{{ route( 'datasources.edit', $datasource->id) }}"><i class="fa fa-pencil"></i> Edit source</a>
			{!! Form::open(array('class' => 'form-inline', 'method' => 'DELETE', 'route' => array('datasources.destroy', $datasource->id))) !!}
				<button class="delete-btn" type="submit"><i class="fa fa-remove"></i> Delete source</button>
			{!! Form::close() !!}
		</div>
		<h2>{{ $datasource->name }}</h2>
		<div class="property-wrapper">
			<h3>Description</h3>
			<div class="property-value">
				{{ $datasource->description }}
			</div>
		</div>
		<div class="property-wrapper">
			<h3>Link</h3>
			<div class="property-value">
				{{ $datasource->link }}
			</div>
		</div>
	</div>
@endsection