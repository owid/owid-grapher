

<ul class="nav nav-pills pull-right">
    <li @if (Request::is('rapyd-demo/form*')) class="active"@endif>{!! link_to("rapyd-demo/form", "DataForm") !!}</li>
    <li @if (Request::is('rapyd-demo/advancedform*')) class="active"@endif>{!! link_to("rapyd-demo/advancedform", "Advanced stuffs") !!}</li>
    <li @if (Request::is('rapyd-demo/styledform*')) class="active"@endif>{!! link_to("rapyd-demo/styledform", "Custom view") !!}</li>
</ul>
