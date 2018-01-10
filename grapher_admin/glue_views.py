import os
from django.conf import settings
from django.http import JsonResponse, HttpResponse, HttpResponseRedirect, Http404
from django.views.static import serve
from mimetypes import MimeTypes
from fnmatch import fnmatch

def _servefile(request, path):
    mime = MimeTypes()
    content_type = mime.guess_type(path)[0] or "text/plain"

    try:
        with open(path, 'rb') as file:
            response = HttpResponse(content=file)
            response['Content-Type'] = content_type
            return response
    except FileNotFoundError:
        raise Http404

class HeaderRule(object):
    def __init__(self, block):
        lines = block.split("\n")
        self.matchRule = lines[0]
        self.headers = []
        for line in lines[1:]:
            if line.strip():
                self.headers.append([s.strip() for s in line.split(": ")])

    def match(self, path):
        return fnmatch(path, self.matchRule)

    def apply(self, response):
        for header in self.headers:
            response[header[0]] = header[1]


def _parseheaders(headers):
    headerRules = []
    for block in headers.split("\n\n"):
        headerRules.append(HeaderRule(block))
    return headerRules


def servestatic(request, path):
    STATIC_PATH = os.path.join(settings.BASE_DIR, "public")

    with open(os.path.join(STATIC_PATH, "_redirects"), "r") as file:
        redirects = [line.split(" ") for line in file.read().split("\n")]

    with open(os.path.join(STATIC_PATH, "_headers"), "r") as file:
        headerRules = _parseheaders(file.read())

    for redirect in redirects:
        if redirect[0] == "/grapher/"+path:
            target = redirect[1]
            if request.META['QUERY_STRING']:
                target += "?" + request.META['QUERY_STRING']
            return HttpResponseRedirect(target)

    target_path = os.path.join(STATIC_PATH, "grapher", path)
    if os.path.isfile(target_path+".html"):
        target_path += ".html"
    response = _servefile(request, target_path)

    for rule in headerRules:
        if rule.match("/grapher/"+path):
            rule.apply(response)
    
    return response


