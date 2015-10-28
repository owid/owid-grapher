<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@yield('title', 'Rapyd crud widgets for laravel 4')</title>
    <meta name="description" content="@yield('description', 'crud widgets for laravel 4. datatable, grids, forms, in a simple package')" />
    @section('meta', '')

    <link href="http://fonts.googleapis.com/css?family=Bitter" rel="stylesheet" type="text/css" />
    <link href="//netdna.bootstrapcdn.com/bootstrap/3.2.0/css/bootstrap.min.css" rel="stylesheet">
    <link href="//maxcdn.bootstrapcdn.com/font-awesome/4.1.0/css/font-awesome.min.css" rel="stylesheet">
    
    {!! Rapyd::styles(true) !!}
</head>
<?php $is_rapyd = (Request::server('HTTP_HOST') == "www.rapyd.com") ? true : false; ?>

<body>
@if (isset($is_rapyd) AND $is_rapyd)
    <!-- Google Tag Manager -->
    <noscript><iframe src="//www.googletagmanager.com/ns.html?id=GTM-5VL356"
                      height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                '//www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','GTM-5VL356');</script>
    <!-- End Google Tag Manager -->
@endif

<div id="wrap">

    <div class="container">

        <br />

        <div class="row">


            <div class="col-sm-12">
                @yield('content')
            </div>

            @if (isset($is_rapyd) AND $is_rapyd)

                <br />
                <br />
                <div id="disqus_thread"></div>


            @endif
        </div>


    </div>



</div>

<div id="footer">
</div>
<script src="http://code.jquery.com/jquery-1.10.1.min.js"></script>
<script src="//netdna.bootstrapcdn.com/bootstrap/3.2.0/js/bootstrap.min.js"></script>
{!! Rapyd::scripts() !!}
@if (isset($is_rapyd) AND $is_rapyd)
    
    <div class="privacy-overlay">
        <div class="privacy-modal"></div>
    </div>
    <link href="/css/policy.css" rel="stylesheet">
    <script src="/js/policy.js"></script>
@endif
</body>
</html>
