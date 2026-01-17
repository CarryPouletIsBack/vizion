import define1 from "./e1ede52dc01ead30@252.js";

function _1(md){return(
md`<div style="color: grey; font: 13px/25.5px var(--sans-serif); text-transform: uppercase;"><h1 style="display: none;">World map (canvas)</h1><a href="https://d3js.org/">D3</a> › <a href="/@d3/gallery">Gallery</a></div>

# World map (canvas)

Compare to [SVG](/@d3/world-map-svg).`
)}

function _projection(projectionInput,URLSearchParams,location){return(
projectionInput({value: new URLSearchParams(location.search).get("projection") || "orthographic"})
)}

function _map(DOM,width,height,d3,projection,outline,graticule,land)
{
  const context = DOM.context2d(width, height);
  const path = d3.geoPath(projection, context);
  context.save();
  // Mer transparente, terres blanches comme dans la maquette.
  context.beginPath(), path(outline), context.clip(), context.clearRect(0, 0, width, height);
  context.beginPath(), path(graticule), context.strokeStyle = "rgba(229, 231, 235, 0.25)", context.stroke();
  context.beginPath(), path(land), context.fillStyle = "#e5e7eb", context.fill();
  context.restore();
  context.beginPath(), path(outline), context.strokeStyle = "rgba(229, 231, 235, 0.4)", context.stroke();
  return context.canvas;
}


function _height(d3,projection,width,outline)
{
  const [[x0, y0], [x1, y1]] = d3.geoPath(projection.fitWidth(width, outline)).bounds(outline);
  const dy = Math.ceil(y1 - y0), l = Math.min(Math.ceil(x1 - x0), dy);
  projection.scale(projection.scale() * (l - 1) / l).precision(0.2);
  return dy;
}


function _outline(){return(
{type: "Sphere"}
)}

function _graticule(d3){return(
d3.geoGraticule10()
)}

function _land(topojson,world){return(
topojson.feature(world, world.objects.land)
)}

function _world(FileAttachment){return(
FileAttachment("land-50m.json").json()
)}

function _d3(require){return(
require("d3-geo@3", "d3-geo-projection@4")
)}

export default function define(runtime, observer) {
  const main = runtime.module();
  function toString() { return this.url; }
  const fileAttachments = new Map([
    ["land-50m.json", {url: new URL("./files/efcaaf9f0b260e09b6afeaee6dbc1b91ad45f3328561cd67eb16a1754096c1095f70d284acdc4b004910e89265b60eba2706334e0dc84ded38fd9209083d4cef.json", import.meta.url), mimeType: "application/json", toString}]
  ]);
  main.builtin("FileAttachment", runtime.fileAttachments(name => fileAttachments.get(name)));
  main.variable(observer()).define(["md"], _1);
  main.variable(observer("viewof projection")).define("viewof projection", ["projectionInput","URLSearchParams","location"], _projection);
  main.variable(observer("projection")).define("projection", ["Generators", "viewof projection"], (G, _) => G.input(_));
  main.variable(observer("map")).define("map", ["DOM","width","height","d3","projection","outline","graticule","land"], _map);
  main.variable(observer("height")).define("height", ["d3","projection","width","outline"], _height);
  main.variable(observer("outline")).define("outline", _outline);
  main.variable(observer("graticule")).define("graticule", ["d3"], _graticule);
  main.variable(observer("land")).define("land", ["topojson","world"], _land);
  main.variable(observer("world")).define("world", ["FileAttachment"], _world);
  main.variable(observer("d3")).define("d3", ["require"], _d3);
  const child1 = runtime.module(define1);
  main.import("projectionInput", child1);
  return main;
}
