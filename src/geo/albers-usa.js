import "conic-equal-area";
import "geo";
//import "composite";

d3.geo.composite = function() {
  var components = [];
  var projection_chooser;

  function composite(coordinates) {
    return projection_chooser(coordinates)(coordinates);
  };

  composite.scale = function(x) {
    if (!arguments.length) return components[0].projection.scale();
    components.forEach(function(c) {
        c.projection.scale(x * c.params.scale);
    });
    return composite.translate(components[0].projection.translate());
  };

  composite.translate = function(x) {
    if (!arguments.length) return components[0].projection.translate();

    var dz = components[0].projection.scale(),
        dx = x[0],
        dy = x[1];
    components.forEach(function(c) {
      var t = c.params.translate;
      c.projection.translate([dx + t[0] * dz, dy + t[1] * dz]);
      if (c.params.extent)
        c.invert = d3_geo_albersUsaInvert(c.projection, c.params.extent);
    });

    return composite;
  };

  composite.add = function(projection, params) {
    var invert = null;
    if (!params.scale) params.scale = 1
    if (!params.translate) params.translate = [0,0]
    if (params.extent)
      invert = d3_geo_albersUsaInvert(projection, params.extent);
    else
      invert = projection.invert;
    components.push({projection: projection, params: params, invert: invert});
    return composite;
  };

  composite.projection = function(p) {
    if (!arguments.length) return projection;
    projection_chooser = p;
    return composite;
  };
  composite.invert = function(coordinates) {
    return components.reverse().reduce(function(a, b) {
      if (a) return a;
      return b.invert(coordinates);
    }, null);
  };

  return composite;
};

// A composite projection for the United States, 960×500. The set of standard
// parallels for each region comes from USGS, which is published here:
// http://egsc.usgs.gov/isb/pubs/MapProjections/projections.html#albers
d3.geo.albersUsa = function() {
  var lower48 = d3.geo.conicEqualArea()
      .rotate([98, 0])
      .center([0, 38])
      .parallels([29.5, 45.5]);

  var alaska = d3.geo.conicEqualArea()
      .rotate([160, 0])
      .center([0, 60])
      .parallels([55, 65]);

  var hawaii = d3.geo.conicEqualArea()
      .rotate([160, 0])
      .center([0, 20])
      .parallels([8, 18]);

  var puertoRico = d3.geo.conicEqualArea()
      .rotate([60, 0])
      .center([0, 10])
      .parallels([8, 18]);

  function projection(point) {
    var lon = point[0],
        lat = point[1];
    return lat > 50 ? alaska
        : lon < -140 ? hawaii
        : lat < 21 ? puertoRico
        : lower48;
  }

  return d3.geo.composite()
      .add(lower48, {})
      .add(puertoRico,
           {translate: [.58, .43],  scale: 1.5, extent: [[-67.5, 17.5], [-65, 19]]})
      .add(hawaii,
           {translate: [-.19, .20], scale: 1,   extent: [[-164, 18], [-154, 24]]})
      .add(alaska,
           {translate: [-.40, .17], scale: .6,  extent: [[-180, 50], [-130, 72]]})
      .projection(projection)
    .scale(1000);
};

function d3_geo_albersUsaInvert(projection, extent) {
  var a = projection(extent[0]),
      b = projection([.5 * (extent[0][0] + extent[1][0]), extent[0][1]]),
      c = projection([extent[1][0], extent[0][1]]),
      d = projection(extent[1]);

  var dya = b[1]- a[1],
      dxa = b[0]- a[0],
      dyb = c[1]- b[1],
      dxb = c[0]- b[0];

  var ma = dya / dxa,
      mb = dyb / dxb;

  // Find center of circle going through points [a, b, c].
  var cx = .5 * (ma * mb * (a[1] - c[1]) + mb * (a[0] + b[0]) - ma * (b[0] + c[0])) / (mb - ma),
      cy = (.5 * (a[0] + b[0]) - cx) / ma + .5 * (a[1] + b[1]);

  // Radial distance² from center.
  var dx0 = d[0] - cx,
      dy0 = d[1] - cy,
      dx1 = a[0] - cx,
      dy1 = a[1] - cy,
      r0 = dx0 * dx0 + dy0 * dy0,
      r1 = dx1 * dx1 + dy1 * dy1;

  // Angular extent.
  var a0 = Math.atan2(dy0, dx0),
      a1 = Math.atan2(dy1, dx1);

  return function(coordinates) {
    var dx = coordinates[0] - cx,
        dy = coordinates[1] - cy,
        r = dx * dx + dy * dy,
        a = Math.atan2(dy, dx);
    if (r0 < r && r < r1 && a0 < a && a < a1) return projection.invert(coordinates);
  };
}
