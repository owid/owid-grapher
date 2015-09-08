
<nav class="navbar main">
    <div class="navbar-header">
        <button type="button" class="navbar-toggle" data-toggle="collapse" data-target=".main-collapse">
            <span class="sr-only"></span>
            <span class="icon-bar"></span>
            <span class="icon-bar"></span>
            <span class="icon-bar"></span>
        </button>
    </div>
    <div class="collapse navbar-collapse main-collapse">
        <ul class="nav nav-tabs">
            <li>{!! link_to("/", "Home", 'target="_blank"') !!}</li>
            <li @if (Request::is('rapyd-demo')) class="active"@endif>{!! link_to("rapyd-demo", "Index") !!}</li>
            <li @if (Request::is('rapyd-demo/models')) class="active"@endif>{!! link_to("rapyd-demo/models", "Models") !!}</li>
            <li @if (Request::is('rapyd-demo/set*')) class="active"@endif>{!! link_to("rapyd-demo/set", "DataSet") !!}</li>
            <li @if (Request::is('rapyd-demo/grid*')) class="active"@endif>{!! link_to("rapyd-demo/grid", "DataGrid") !!}</li>
            <li @if (Request::is('rapyd-demo/filter*', 'rapyd-demo/customfilter*')) class="active"@endif>{!! link_to("rapyd-demo/filter", "DataFilter") !!}</li>
            <li @if (Request::is('rapyd-demo/form*','rapyd-demo/advancedform*','rapyd-demo/styledform*')) class="active"@endif>{!! link_to("rapyd-demo/form", "DataForm") !!}</li>
            <li @if (Request::is('rapyd-demo/edit*')) class="active"@endif>{!! link_to("rapyd-demo/edit", "DataEdit") !!}</li>
        </ul>
    </div>
</nav>
