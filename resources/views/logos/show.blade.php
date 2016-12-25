@extends('app')

@section('content')
	<div class="module-wrapper show-logo-module">
		<a class="back-btn" href="{!! route( 'logos.index' ) !!}"><i class="fa fa-arrow-left"></i>Back to the list of logos</a>
		<div class="pull-right right-btns-wrapper clearfix">
			<a href="{{ route( 'logos.edit', $logo->id) }}"><i class="fa fa-pencil"></i> Edit logo</a>
			{!! Form::open(array('class' => 'form-inline', 'method' => 'DELETE', 'route' => array('logos.destroy', $logo->id))) !!}
				<button class="delete-btn" type="submit"><i class="fa fa-remove"></i> Delete logo</button>
			{!! Form::close() !!}
		</div>
		<h2>{{ $logo->name }}</h2>
		{!! $logo->svg !!}
	</div>
@endsection