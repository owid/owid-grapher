@extends('app')

@section('content')
	<div class="module-wrapper show-datasource-module">
		<a class="back-btn" href="{!! route( 'sources.index' ) !!}"><i class="fa fa-arrow-left"></i>Back to the list of sources</a>
		<div class="pull-right right-btns-wrapper clearfix">
			<a href="{{ route( 'sources.edit', $source->id) }}"><i class="fa fa-pencil"></i> Edit source</a>
			{!! Form::open(array('class' => 'form-inline', 'method' => 'DELETE', 'route' => array('sources.destroy', $source->id))) !!}
				<button class="delete-btn" type="submit"><i class="fa fa-remove"></i> Delete source</button>
			{!! Form::close() !!}
		</div>
		<h2>{{ $source->name }}</h2>
		<div class="property-wrapper">
			<h3>Variables</h3>
			<div class="property-value">
				<ul>
				@foreach ($source->variables as $variable)
					<li><a href="{{ route('variables.show', $variable->id) }}">{{ $variable->name }}</a></li>
				@endforeach
				</ul>
			</div>
		</div>
		<div class="property-wrapper">
			<h3>Description</h3>
			<div class="property-value">
				{!! $source->description !!}
			</div>
		</div>
	</div>
@endsection