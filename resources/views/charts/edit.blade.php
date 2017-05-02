@extends('admin')
 
@section('content')
	<div id="editor" style="position:absolute;top:0;left:0;right:0;bottom:0;">
        <div class="chart-container"></div>
		@include('charts/partials/_form', ['method' => 'put', 'submitLabel' => 'Update chart'])
	</div>
@endsection

@section('outter-content')
	@include('charts/partials/_select-var-popup')
	@include('charts/partials/_settings-var-popup')
@endsection

@section('scripts')
    <script type="text/javascript">
        var chartConfig = {!! $chartConfig !!};
        Chart().update(
            { chartConfig: chartConfig, containerNode: d3.select('.chart-container').node(), isEditor: true },
            function() {
                new App.Views.FormView();
            }
        );
    </script>
@endsection