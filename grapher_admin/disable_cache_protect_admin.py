from django.contrib.auth.decorators import login_required


class DisableCacheProtectAdminPages(object):

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):

        response = self.get_response(request)

        if '/grapher/admin' in request.path:
            response['Cache-Control'] = 'no-cache'

        return response

    def process_view(self, request, view_func, view_args, view_kwargs):

        if '/grapher/admin' in request.path:
            if not '/grapher/admin/login' in request.path:
                return login_required(view_func)(request, *view_args, **view_kwargs)

        return None
