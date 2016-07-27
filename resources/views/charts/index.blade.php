@extends('app')

@section('content')
	<div class="col-xs-12">
		<div class="box">
			<div class="box-header">
				<h2>Charts</h2>
				<a href="{!! route('charts.create') !!}" class="btn btn-success">New chart</a>
			</div>
				@if ( !$charts->count() )
					There are no charts.
				@else
					<table id="charts-index" class="table table-bordered table-hover dataTable">
						<thead>
							<tr>
								<th><i class="fa fa-star"></i></th>
								<th>Name</th>
								<th>Type</th>
								<th>Variables</th>
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
								<td>
									@if ($chart->published)
										<a class="star-toggle" data-chart-id="{{$chart->id}}" title="Show this chart on the front page of the website.">
											@if ($chart->starred)
												<i class="fa fa-star"></i>
											@else
												<i class="fa fa-star-o"></i>
											@endif
										</a>
									@endif
								</td>
								<td>
									@if (!$chart->published)
										<span style="color: red;">Draft: </span> {{ $chart->name }}
									@else
										<a href="{{ URL::to($chart->slug) }}">{{ $chart->name }}</a></td>
									@endif
								<td>{{ $chart->showType() }}</td>
								<td>
									@foreach ($chart->variables as $variable)
										<a href="{{ route('variables.show', $variable->id) }}">{{ $variable->name }}</a><br>
									@endforeach
								</td>
								<td>{{ $chart->notes }}</td>
								<td>
									@if ( $chart->origin_url )
										<a href="{{ $chart->origin_url }}">{{ $chart->origin_url }}</a>									
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