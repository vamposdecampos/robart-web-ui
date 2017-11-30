function RobartView(div_id) {
	this.div_id = div_id;
	this.init();
}
RobartView.prototype = {
	init: function() {
		this.zoomer = null;
		this.selection = {
			x: 0,
			y: 0,
			area_id: 0
		};

		this.draw = SVG(this.div_id);
		var root = this.draw.group();
		root.flip('x');
		this.feature_map = root.group();
		this.polygons = root.group();
		this.cleaning_grid = root.group();
		this.areas = root.group();
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

		var lines = (data && data.map && data.map.lines) ? data.map.lines : [];
		for (var k = 0; k < lines.length; k++) {
			var seg = lines[k];
			this.feature_map.line(seg.x1, seg.y1, seg.x2, seg.y2).stroke({width: 5});
		}
		if (data.map && data.map.docking_pose) {
			var pose = data.map.docking_pose;
			this.feature_map.circle(50).move(pose.x, pose.y).fill({color: 'blue'});
		}
		this.setup_zoomer();
	},
	load_areas: function(data) {
		this.areas.clear();

		var areas = (data && data.areas) ? data.areas : [];
		for (var k = 0; k < areas.length; k++) {
			var area = areas[k];
			var segs = [];
			var points = area.points || [];
			for (var q = 0; q < points.length; q++) {
				var pt = points[q];
				segs.push(pt.x);
				segs.push(pt.y);
			}
			var poly = this.areas.polygon(segs).fill({color: 'blue', opacity: 0.1}).stroke({width: 5});
			poly.remember('area_id', area.id);
			var me = this;
			poly.click(function(evt) {
				me.area_clicked(this.remember('area_id'));
			});
		}
		this.setup_zoomer();
	},
	load_polygons: function(data) {
		this.polygons.clear();
		for (var k = 0; k < data.map.polygons.length; k++) {
			var polygon = data.map.polygons[k];
			var segs = [];
			for (var q = 0; q < polygon.segments.length; q++) {
				var seg = polygon.segments[q];
				segs.push(seg.x1);
				segs.push(seg.y1);
				// there is an .x2 and .y2, but they just repeat
				// .x1 and .y1 of the next segment
			}
			this.polygons.polygon(segs).stroke({width: 5, color: 'red'}).fill('none');
		}
		this.setup_zoomer();
	},
	load_cleaning_grid_map: function(data) {
		this.cleaning_grid.clear();
		var cleaned = this.decode_rle(data.cleaned);
		var res = data.resolution;
		var ox = data.lower_left_x;
		var oy = data.lower_left_y;
		var idx = 0;
		for (var y = 0; y < data.size_y; y++) {
			for (var x = 0; x < data.size_x; x++, idx++) {
				if (!cleaned[idx])
					continue;
				this.cleaning_grid.rect(res, res)
					.stroke({color: 'white', width: 1})
					.fill({color: 'green', opacity: 0.4})
					.move(ox + x * res, oy + y * res);
			}
		}
		this.setup_zoomer();
	},

	decode_rle: function(items) {
		var res = [];
		var last = items[0];
		for (var k = 1; k < items.length; k++) {
			var cnt = items[k];
			last = last ? 0 : 1;
			res.push.apply(res, Array(cnt).fill(last));
		}
		return res;
	},

	update_status: function() {
		var text = 'x=' + this.selection.x +
			' y=' + this.selection.y +
			' area_id=' + this.selection.area_id;
		$("#status").text(text);
	},

	area_clicked: function(area_id) {
		console.log('area clicked:', area_id);
		this.selection.area_id = area_id;
		this.update_status();
	},
	clicked: function(loc) {
		console.log('clicked:', loc);
		this.selection.x = Math.round(loc.x);
		this.selection.y = Math.round(loc.y);
		this.update_status();
	}
};

rv = new RobartView('drawing')
