@extends('app')

@section('content')
	<h2>Variables</h2>
	@if ( !$variables->count() )
		There are no variables.
	@else
		<ul>
			@foreach( $variables as $variable )
				<li><a href="{{ route('variables.show', $variable->id) }}">{{ $variable->name }}</a></li>
			@endforeach
		</ul>
	@endif
@endsection