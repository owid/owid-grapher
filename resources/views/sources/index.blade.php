@extends('app')

@section('content')
	<h2>Sources</h2>
	<table class="table table-bordered table-hover dataTable">
		<thead>
			<tr>
				<th>Source</th>
				<th>Dataset</th>
				<th>Variables</th>
			</tr>
		</thead>
		<tbody>
			@foreach ($sources as $source)
				<tr>
					<td><a href="{{ route('sources.show', $source->id) }}">{{ $source->name }}</a></td>
					<td>
						<a href="{{ route('datasets.show', $source->dataset->id) }}">{{ $source->dataset->name }}</a>
					</td>
					<td>
						@foreach ($source->variables as $variable)
							<a href="{{ route('variables.show', $variable->id) }}">{{ $variable->name }}</a><br>
						@endforeach
					</td>
				</tr>
			@endforeach
		</tbody>
	</table>
@endsection