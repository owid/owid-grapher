@if (isset($category))
	{!! Form::model( $category, array( 'method' => $method, 'route' => $route, 'class' => 'col-sm-12 col-md-6 p0' ) ) !!}
@else
	{!! Form::open( array( 'method' => $method, 'route' => $route, 'class' => 'col-sm-12 col-md-6 p0' ) ) !!}
@endif
	<div class="form-group">
		{!! Form::label('name', 'Name:') !!}
		{!! Form::text('name', null, array('class' => 'form-control', 'required' => 'required' ) ) !!}
	</div>
	<div class="form-group">
		{!! Form::submit( $submitLabel, ['class'=>'btn btn-success']) !!}
	</div>
{!! Form::close() !!}