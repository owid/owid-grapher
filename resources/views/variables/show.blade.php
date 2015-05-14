@extends('app')

@section('content')
	{!! link_to_route( 'variables.index', 'Variables' ) !!}
	<h2>{{ $variable->name }}</h2>
	<ul>
		@foreach( $variable->data as $datum )
			<li>{{ $datum->value }}</a></li>
		@endforeach
	</ul>
@endsection