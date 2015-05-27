@extends('app')

@section('styles')
	<link href="{{ asset('css/admin/charts.css') }}" rel="stylesheet" type="text/css">
@endsection

@section('content')
	<div class="col-xs-12">
		<div class="box">
			<div class="box-header">
				<h2>Charts</h2>
				<a href="{!! route('charts.create') !!}" class="btn btn-success">Create new chart</a>
			</div>
			<div class="box-body">
				@if ( !$charts->count() )
					There are no charts.
				@else
					<table class="table table-bordered table-hover dataTable">
						@foreach( $charts as $chart )
							<tr>
								<td><a href="{{ route('charts.show', $chart->id) }}">{{ $chart->name }}</a></td>
								<td><a href="{{ route('charts.edit', $chart->id) }}" class="btn btn-primary">Edit</a></td>
								<td>
									{!! Form::open(array('class' => 'form-inline', 'method' => 'DELETE', 'route' => array('charts.destroy', $chart->id))) !!}
										{!! Form::submit('Delete', array('class' => 'btn btn-danger')) !!}
									{!! Form::close() !!}
							</tr>
						@endforeach
					</table>
				@endif
			</div>
		</div>
	</div>
@endsection