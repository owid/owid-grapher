@extends('app')

@section('content')
	<div class="module-wrapper show-dataset-module">
		<a class="back-btn" href="{!! route( 'datasets.index' ) !!}"><i class="fa fa-arrow-left"></i>Back to the list of datasets</a>
		<div class="pull-right right-btns-wrapper clearfix">
			<a href="{{ route( 'datasets.edit', $dataset->id) }}"><i class="fa fa-pencil"></i> Edit dataset</a>
			{!! Form::open(array('class' => 'form-inline', 'method' => 'DELETE', 'route' => array('datasets.destroy', $dataset->id))) !!}
				<button class="delete-btn" type="submit"><i class="fa fa-remove"></i> Delete dataset</button>
			{!! Form::close() !!}
		</div>
		<h2>{{ $dataset->name }}</h2>
		<p>Categorized as: <strong>{{ $dataset->category->name}}/{{ $dataset->subcategory->name}}</strong>.</p>
		<div class="property-wrapper">
			<h3>Description</h3>
			<div class="property-value">
				{{ $dataset->description }}
			</div>
		</div>
		<div class="property-wrapper">
			<h3 class="property-title">Source</h3>
			<div class="property-value">
				{{ $dataset->datasource->name }}
			</div>
		</div>
		<h3>Variables</h3>
		<ul>
			@foreach( $dataset->variables as $variable )
				<li><a href="{{ route('variables.show', $variable->id) }}">{{ $variable->name }}</a></li>
			@endforeach
		</ul>
	</div>
@endsection