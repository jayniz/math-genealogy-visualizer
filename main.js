import * as dagreD3 from 'dagre-d3';
import * as graphlibDot from 'graphlib-dot';
import * as FuzzySet from 'fuzzyset.js';

import {
  ancestryGraph,
  closestAncestor,
  commonAncestryGraph,
  shortestPath,
} from './graph_search';


var data = null;  // Contains the raw graph data
var fuzzyNames = FuzzySet.default();
let width = 1280;
let height = 1000;
let svg = d3.select("body").append("svg")
                           .attr("width", width)
                           .attr("height", height)
                           .style("cursor", "move");

let initialScale = '0.2';
let inner = svg.append("g").attr("transform", `scale(${initialScale},${initialScale})`);

// Set up zoom support
let zoom = d3.behavior.zoom().scale(initialScale).on("zoom", function() {
  inner.attr("transform", "translate(" + d3.event.translate + ")" +
                              "scale(" + d3.event.scale + ")");
});
svg.call(zoom);

function convertData(d) {
  // decompress the input
  let nodes = d.nodes;
  let edges = d.edges;

  let allKeys = Object.keys(nodes).map(x => parseInt(x));
  let maxKey = 0;
  for (let i = 0, n = allKeys.length; i < n; i++) {
    if (allKeys[i] > maxKey) {
      maxKey = allKeys[i];
    }
  }
  let graph = new Array(1 + maxKey);

  // graph is a list whose index is the id, and the entries are objects of the form
  //
  // {
  //   name: str,
  //   in: [int],   <-- list of ids of incoming edges
  //   out: [int],  <-- list of ids of outgoing edges
  // }

  for (let id in nodes) {
    let mgp_id = parseInt(id);
    let name = nodes[id];
    if (name) {
      graph[mgp_id] = {
        'name': name,
        'in': [],
        'out': [],
      };
      fuzzyNames.add(name);
    }
  }

  for (let i = 0, n = edges.length; i < n; i++) {
    let source = edges[i][0];
    let target = edges[i][1];
    graph[source]['out'].push(target);
    graph[target]['in'].push(source);
  }

  return graph;
}


function setSearchBar() {
  console.log('Selecting ' + this.innerText);
  d3.select('#name_input').property('value', this.innerText);
  d3.select('#autocomplete_results').style('display', 'none');
  renderFromSearch();
}


function suggest() {
  let searchString = d3.select('#name_input').property('value');
  let autocomplete = d3.select('#autocomplete_results');
  console.log('Autocompleting ' + searchString);

  if (d3.event.keyCode == 13) {
    autocomplete.style('display', 'none');
    renderFromSearch();
  } else {
    var results = null;
    if (searchString.length >= 3) {
      results = fuzzyNames.get(searchString, '', 0.3);
    }

    let dataList = autocomplete.selectAll('li')
                               .data([]).exit().remove();
    if (results) {
      let dataList = autocomplete.selectAll('option').data(results);

      dataList.enter()
              .append('li')
              .attr('class', 'autocomplete_option')
              .attr('value', function (d) { return d[1]; })
              .text(function (d) { return d[1]; });
    }

    d3.selectAll('.autocomplete_option').on('click', setSearchBar);
    autocomplete.style('display', 'block');
  }
}


d3.json("genealogy_graph.json", function(error, d) {
  if (error) throw error;
  console.log('Done loading data');
  data = convertData(d);
  window.data = data;
  console.log('Done converting data');
  d3.select('#hide_while_loading').style('display', 'block');
  d3.select('#loading').style('display', 'none');
});


function edgeListToStrings(edges) {
  return edges.map(function(e) {
    let sourceName = data[e[0]].name;
    let targetName = data[e[1]].name;
    return '"' + sourceName + '" -> "' + targetName + '";';
  });
}


// Create and configure the renderer
var render = dagreD3.render();

function createGraphFor(id) {
  let graph;
  let gauss = 18231;
  let jeremy = 203505;
  let edgeStrings = edgeListToStrings(commonAncestryGraph(data, id, jeremy));
  let graphString = "digraph { ";

  graphString = graphString + " \"" + data[id].name + "\" [style=\"fill: #66ff66; font-weight: bold\"];";

  for (let edge of edgeStrings) {
    graphString = graphString + " " + edge + " ";
  }
  graphString = graphString + "}";

  try {
    graph = graphlibDot.read(graphString);
  } catch (e) {
    console.log('Failed to parse graph...')
    throw e;
  }

  // Render the graph into svg g
  d3.select("svg g").call(render, graph);

  // Zoom and translate to center
  let graphWidth = graph.graph().width;
  let graphHeight = graph.graph().height;
  let zoomScale = Math.min(width / graphWidth, height / graphHeight);
  let translate = [(width/2) - ((graphWidth * zoomScale)/2), 0];
  zoom.translate(translate);
  zoom.scale(zoomScale);
  zoom.event(inner);

  return graph;
}


function renderFromSearch() {
  let name = d3.select('#name_input').property("value");
  name = name.trim();

  let found_id = null;
  for (let i = 0, n = data.length; i < n; i++) {
    if (data[i] && data[i].name && name == data[i].name) {
      console.log('Found name ' + name + ' with id ' + i.toString());
      found_id = i;
      break;
    }
  }

  if (found_id) {
    d3.select("#name_not_found").style('display', 'none');
    createGraphFor(found_id);
  } else {
    d3.select("#name_not_found").style('display', 'block');
  }
}


d3.select("#name_input").on("keyup", suggest);
d3.select('#ancestry_button').on('click', renderFromSearch);
d3.select('#autocomplete_results').style('display', 'none');
d3.select('#loading').style('display', 'block');
d3.select('#hide_while_loading').style('display', 'none');


window.shortestPath = shortestPath;
window.closestAncestor = closestAncestor;
