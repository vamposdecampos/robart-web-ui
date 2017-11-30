#!/usr/bin/env python

from flask import Flask
from flask import request
from flask import redirect

app = Flask(__name__, static_folder='static', static_url_path='')

@app.route('/')
def root():
	return redirect('/app.html', code=301)

if __name__ == "__main__":
	app.run()
