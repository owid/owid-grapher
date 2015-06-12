@extends('app')

@section('content')
	<div class="module-wrapper show-license-module">
		<a class="back-btn" href="{!! route( 'licenses.index' ) !!}"><i class="fa fa-arrow-left"></i>Back to the list of licenses</a>
		<div class="pull-right right-btns-wrapper clearfix">
			<a href="{{ route( 'licenses.edit', $license->id) }}"><i class="fa fa-pencil"></i> Edit license</a>
		</div>
		<h2>{{ $license->name }}</h2>
		<div class="property-wrapper">
			<h3>Description</h3>
			<div class="property-value">
				{!!html_entity_decode( $license->description ) !!}
			</div>
		</div>
	</div>
@endsection