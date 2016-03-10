@extends('app')

@section('content')
	<div class="col-xs-12">
		<div class="box">
			<div class="box-header">
				<h2>Charts</h2>
				<a href="{!! route('charts.create') !!}" class="btn btn-success">Create new chart</a>
			</div>
				@if ( !$charts->count() )
					There are no charts.
				@else
					<table class="table table-bordered table-hover dataTable">
						<thead>
							<tr>
								<th>Name</th>
								<th>Notes</th>
								<th>Last Seen On</th>
								<th>Last Updated</th>
								<th></th>
								<th></th>
							</tr>
						</thead>
						<tbody>
						@foreach( $charts as $chart )
							<tr>
								<td><a href="{{ URL::to($chart->slug) }}">{{ $chart->name }}</a></td>
								<td>{{ $chart->notes }}</td>
								<td>
									@if ( $chart->last_referer_url )
										<a href="{{ $chart->last_referer_url }}">{{ $chart->last_referer_url }}</a>									
									@endif
								</td>
								<td>
									<time class="timeago" datetime="{{ $chart->last_edited_at->toIso8601String() }}">{{ $chart->last_edited_at }}</time>
									@if ( $chart->last_edited_by )
										by {{ $chart->last_edited_by }}
									@endif
								</td>
								<td><a href="{{ route('charts.edit', $chart->id) }}" class="btn btn-primary">Edit</a></td>
								<td>
									{!! Form::open(array('class' => 'form-inline', 'method' => 'DELETE', 'route' => array('charts.destroy', $chart->id))) !!}
										{!! Form::submit('Delete', array('class' => 'btn btn-danger')) !!}
									{!! Form::close() !!}
							</tr>
						@endforeach
						</tbody>
					</table>
				@endif
		</div>
	</div>
@endsection