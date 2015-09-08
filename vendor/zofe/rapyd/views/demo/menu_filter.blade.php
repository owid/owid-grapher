

<ul class="nav nav-pills pull-right">
    <li @if (Request::is('rapyd-demo/filter*')) class="active"@endif>{!! link_to("rapyd-demo/filter", "DataFilter") !!}</li>
    <li @if (Request::is('rapyd-demo/customfilter*')) class="active"@endif>{!! link_to("rapyd-demo/customfilter", "Customizations") !!}</li>
</ul>
