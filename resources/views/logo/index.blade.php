@extends('app')

@section('styles')
  <link href="{{ asset('css/main.css') }}" rel="stylesheet" type="text/css">
@endsection

@section('content')
	<div class="module-wrapper logo-module">
		<h2>Logo</h2>
		<div class="image-wrapper">
			@if( !empty($logoUrl) )
				<img src="{{ $logoUrl->meta_value }}" title="Logo"/>
			@else
				<p>No logo uploaded</p>
			@endif
		</div>
		{!! Form::open(array('url'=>'logo/upload','method'=>'POST', 'files'=>true)) !!}
			{!! Form::file('image') !!}
			{!! Form::submit('Submit', array('class'=>'btn btn-success form-control')) !!}
		{!! Form::close() !!}
	</div>
@endsection
