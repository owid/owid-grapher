from django.http import HttpResponse
from django.shortcuts import render
from django.conf import settings
import os
import json

def chart(request, slug):
	"""
	manifest = json.loads(open(os.path.join(settings.BASE_DIR, "public/build/manifest.json")).read())
	jsPath = f"/build/{manifest['charts.js']}"
	cssPath = f"/build/{manifest['charts.css']}"
	"""

	jsPath = f"http://localhost:8090/charts.bundle.js"
	cssPath = f"http://localhost:8090/charts.bundle.css"

	return render(request, 'grapher/chart.html', context=dict(jsPath=jsPath, cssPath=cssPath, slug=slug))