{!! Form::model( $subcategory, array( 'method' => $method ) ) !!}
	<div class="form-group">
		{!! Form::label('name', 'Name:') !!}
		{!! Form::text('name', null, array('class' => 'form-control')) !!}
	</div>
	<div class="form-group">
		{!! Form::submit('Update dataset', ['class'=>'btn btn-success']) !!}
	</div>
{!! Form::close() !!}