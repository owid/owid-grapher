@extends('view')

@section('styles')
  <link href="{{ asset('css/main.css') }}" rel="stylesheet" type="text/css">
@endsection

@section('content')
	{!! Form::open(array('url'=>'logo/upload','method'=>'POST', 'files'=>true)) !!}
		{!! Form::file('image') !!}
		{!! Form::submit('Submit', array('class'=>'send-btn')) !!}
	{!! Form::close() !!}
@endsection
