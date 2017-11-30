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
		this.data_sources = [
			{ name: "feature_map" },
			{ name: "areas" },
			{ name: "n_n_polygons" },
			{ name: "cleaning_grid_map", mapless: true }
		];

		this.draw = SVG(this.div_id);
		var root = this.draw.group();
		root.flip('x');
		this.feature_map = root.group();
		this.polygons = root.group();
		this.cleaning_grid = root.group();
		this.areas = root.group();
		this.markers = root.group();
		this.markers.flip('x'); // weird. the others don't need that.
	},

	setup_zoomer: function() {
		if (this.zoomer) {
			this.zoomer.fit();
			this.zoomer.center();
			return;
		}

		var eventsHandler = {
			haltEventListeners: ['touchstart', 'touchend', 'touchmove', 'touchleave', 'touchcancel'],
			init: function(options) {
				var instance = options.instance,
					initialScale = 1,
					pannedX = 0,
					pannedY = 0;

				this.hammer = Hammer(options.svgElement, {
					inputClass: Hammer.SUPPORT_POINTER_EVENTS ? Hammer.PointerEventInput : Hammer.TouchInput
				});
				this.hammer.get('pinch').set({enable: true})
				this.hammer.on('doubletap', function(ev) {
					instance.zoomIn();
				});
				this.hammer.on('panstart panmove', function(ev) {
					if (ev.type === 'panstart') {
						pannedX = 0;
						pannedY = 0;
					}

					instance.panBy({x: ev.deltaX - pannedX, y: ev.deltaY - pannedY});
					pannedX = ev.deltaX;
					pannedY = ev.deltaY;
				});

				this.hammer.on('pinchstart pinchmove', function(ev) {
					if (ev.type === 'pinchstart') {
						initialScale = instance.getZoom();
						instance.zoom(initialScale * ev.scale);
					}
					instance.zoom(initialScale * ev.scale);
				});

				// Prevent moving the page on some devices when panning over SVG
				options.svgElement.addEventListener('touchmove', function(e) { e.preventDefault(); });
			},

			destroy: function() {
				this.hammer.destroy();
			}
		};

		this.zoomer = svgPanZoom('#' + this.div_id + ' > svg', {
			customEventsHandler: eventsHandler,
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

	parse_feature_map: function(data) {
		this.feature_map.clear();

		var lines = (data && data.map && data.map.lines) ? data.map.lines : [];
		for (var k = 0; k < lines.length; k++) {
			var seg = lines[k];
			this.feature_map.line(seg.x1, seg.y1, seg.x2, seg.y2).stroke({width: 5});
		}
		if (data.map && data.map.docking_pose) {
			var pose = data.map.docking_pose;
			this.feature_map.circle(50).move(pose.x - 25, pose.y - 25).fill({color: 'blue'});
		}
		this.setup_zoomer();
	},
	parse_areas: function(data) {
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
	parse_n_n_polygons: function(data) {
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
	parse_cleaning_grid_map: function(data) {
		if (!this.selection.map_id) {
			/* if this is the first thing we fetched, use the map_id to fetch the rest */
			this.selection.map_id = data.map_id;
			this.fetch_all_data();
		}
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
		$.each(this.data_sources, function(idx, ds) {
			if (ds.loading)
				text += ' ' + ds.name + '...';
		});
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
		this.markers.clear();
		this.markers.polygon('50,0 60,40 100,50 60,60 50,100 40,60 0,50 40,40')
			.fill({color: 'blue'})
			.move(this.selection.x - 50, this.selection.y - 50);
		this.update_status();
	},


	fetch_map: function(map_id) {
		this.selection.map_id = map_id;
		var me = this;
		$.getJSON('get/feature_map?map_id=' + this.selection.map_id, function(data) {
			me.load_feature_map(data);
		});
		$.getJSON('get/areas?map_id=' + this.selection.map_id, function(data) {
			me.load_areas(data);
		});
		$.getJSON('get/n_n_polygons?map_id=' + this.selection.map_id, function(data) {
			me.load_polygons(data);
		});
	},
	fetch_all_data: function() {
		var me = this;
		$.each(this.data_sources, function(idx, ds) {
			if (ds.loaded)
				return;
			if (!(ds.mapless || me.selection.map_id))
				return;
			var path = 'get/' + ds.name;
			if (!ds.mapless)
				path += '?map_id=' + me.selection.map_id;
			console.log('fetch:', path);
			ds.loading = true;
			$.getJSON(path, function(data) {
				ds.loading = false;
				ds.loaded = true;
				me['parse_' + ds.name](data);
				me.update_status();
			});
		});
		this.update_status();
	},
	do_load: function() {
		$.getJSON('get/robot_name', function(data) {
			document.title = data.name;
		});
		this.fetch_all_data();
	}
};

rv = new RobartView('drawing')
$('#btn_load').click(function() { rv.do_load(); });
rv.do_load();
