@extends('rapyd::demo.master')

@section('title','Models')

@section('body')
    <h1>Models Used</h1>


    <p>
        These are the entities used in this demo:
        <br />

    </p>

    {!! Documenter::showCode("zofe/rapyd/src/Demo/Article.php") !!}
    {!! Documenter::showCode("zofe/rapyd/src/Demo/ArticleDetail.php") !!}
    {!! Documenter::showCode("zofe/rapyd/src/Demo/Author.php") !!}
    {!! Documenter::showCode("zofe/rapyd/src/Demo/Category.php") !!}
    {!! Documenter::showCode("zofe/rapyd/src/Demo/Comment.php") !!}

@stop


@section('content')

    @include('rapyd::demo.menu')

    @yield('body')

@stop
