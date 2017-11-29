function RobartView(div_id) {
	this.div_id = div_id;
	this.init();
}
RobartView.prototype = {
	init: function() {
		this.zoomer = null;
		this.draw = SVG(this.div_id);
		this.feature_map = this.draw.group();
	},

	setup_zoomer: function() {
		if (this.zoomer) {
			this.zoomer.fit();
			this.zoomer.center();
			return;
		}

		this.zoomer = svgPanZoom('#' + this.div_id + ' > svg', {
			panEnabled: true,
			controlIconsEnabled: false,
			zoomEnabled: true,
			dblClickZoomEnabled: true,
			mouseWheelZoomEnabled: true,
			zoomScaleSensitivity: 0.2,
			minZoom: 0.2,
			maxZoom: 3,
			fit: true,
			contain: true,
			center: true,
			refreshRate: 'auto'
		});

		// TODO: something less brittle?
		var zoomer_el = document.querySelector(".svg-pan-zoom_viewport");

		var me = this;
		this.draw.click(function(evt) {
			var loc = me.draw.node.createSVGPoint();
			loc.x = evt.clientX;
			loc.y = evt.clientY;
			loc = loc.matrixTransform(zoomer_el.getCTM().inverse());
			me.clicked(loc);
		});
	},

	load_feature_map: function(data) {
		this.feature_map.clear();

		var lines = data.map.lines;
		for (var k = 0; k < lines.length; k++) {
			var seg = lines[k];
			this.feature_map.line(seg.x1, seg.y1, seg.x2, seg.y2).stroke({width: 3});
		}
		this.setup_zoomer();
	},
	clicked: function(loc) {
		console.log('clicked:', loc);
	}
};

rv = new RobartView('drawing')
