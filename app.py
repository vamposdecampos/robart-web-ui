#!/usr/bin/env python

ROBOT_URL = 'http://robot:10009'

from flask import Flask
from flask import request
from flask import redirect
from flask import Response
from flask import stream_with_context
import requests

app = Flask(__name__, static_folder='static', static_url_path='')

@app.route('/get/<path>')
@app.route('/set/<path>')
def proxy(path):
	url = ROBOT_URL + request.path
	req = requests.get(url, stream = True, params = request.args)
	return Response(stream_with_context(req.iter_content()),
		content_type = req.headers['content-type'])

@app.route('/')
def root():
	return redirect('/app.html', code=301)

if __name__ == "__main__":
	app.run(host='', debug=True)
