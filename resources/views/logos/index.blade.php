@extends('app')

@section('content')
	<h2>Logos</h2>
	<a href="{{ route('logos.create') }}" class="btn btn-success btn-new-logo"><i class="fa fa-plus"></i> Create new logo</a>
	@if ( !$logos->count() )
		<p>There are no logos.</p>
	@else
		<ul>
			@foreach( $logos as $logo )
				<li><a href="{{ route('logos.show', $logo->id) }}">{{ $logo->name }}</a></li>
			@endforeach
		</ul>
	@endif
@endsection