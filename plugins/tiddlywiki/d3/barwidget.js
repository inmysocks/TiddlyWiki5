/*\
title: $:/plugins/tiddlywiki/d3/barwidget.js
type: application/javascript
module-type: widget

A widget for displaying stacked or grouped bar charts. Derived from http://bl.ocks.org/mbostock/3943967

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget,
	d3 = require("$:/plugins/tiddlywiki/d3/d3.js").d3;

var BarWidget = function(parseTreeNode,options) {
	this.initialise(parseTreeNode,options);
};

/*
Inherit from the base widget class
*/
BarWidget.prototype = new Widget();

/*
Render this widget into the DOM
*/
BarWidget.prototype.render = function(parent,nextSibling) {
	// Save the parent dom node
	this.parentDomNode = parent;
	// Compute our attributes
	this.computeAttributes();
	// Execute our logic
	this.execute();
	// Create the chart
	var chart = this.createChart(parent,nextSibling);
	this.updateChart = chart.updateChart;
	if(this.updateChart) {
		this.updateChart();
	}
	// Insert the chart into the DOM and render any children
	parent.insertBefore(chart.domNode,nextSibling);
	this.domNodes.push(chart.domNode);
};

BarWidget.prototype.createChart = function(parent,nextSibling) {
	var data, settings, i, layers =[], n;
	// If a chart name is given than the settings and data tiddlers can be derived from the name.
	// If a data tiddler or settings tiddler is given in addition to the chart name than they override the derived names.
	if(this.chartName) {
		if(this.barData) {
			//Use the barData tiddler instead of the derived data tiddler.
			data = this.wiki.getTiddlerData(this.barData);
		} else {
			//Use the data from the tiddler derived from the chart name.
			barDataTiddler = "$:/datasets/" + this.chartName;
			data = this.wiki.getTiddlerData(barDataTiddler);
		}
		if(this.settingsTiddler) {
			//Use the given settings tiddler.
			settings = this.wiki.getTiddlerData(this.settingsTiddler);
		} else {
			//Use the settings tiddler derived from the chart name.
			barSettingsTiddler = "$:/settings/" + this.chartName;
			settings = this.wiki.getTiddlerData(barSettingsTiddler);
		}
	} else {
		//If no chart name is given use the given data and settings tiddlers.
		settings = this.wiki.getTiddlerData(this.settingsTiddler);
		data = this.wiki.getTiddlerData(this.barData);
	}

	var m,stack;
	if(settings) {
		var chartHeight = settings.height,
		chartWidth = settings.width,
		chartMarginRight = settings.rightmargin,
		chartMarginLeft = settings.leftmargin,
		chartMarginTop = settings.topmargin,
		chartMarginBottom = settings.bottommargin,
		chartTransitionDuration = settings.charttransition,
		numTics = settings.numTics_yaxis,
		max_modifier = settings.max_modifier,
		max_scale = settings.max_scale_factor;
		this.Xlabel = settings.x_label;
		this.Ylabel = settings.y_label;
	}

	if(data) {
		var i = 0;
		for(var name in data) {
			if(data[name] === "true") {
				layers[i] = this.wiki.getTiddlerData(name).data;
				i++;
			}
		}
		n = layers.length;
		if(layers[0]) {
			m = layers[0].length;
			for(i=0; i<layers.length; i++) {
				if(layers[i].length > m) {
					m = layers[i].length;
				}
			}
		}
	}

	// Calculate the maximum data values
	var yGroupMax = max_modifier + max_scale*d3.max(layers, function(layer) { return d3.max(layer, function(d) { return d.y; }); }),
		yStackMax = d3.max(layers, function(layer) { return d3.max(layer, function(d) { return d.y; }); });
	// Calculate margins and width and height
	var margin = {top: chartMarginTop, right: chartMarginRight, bottom: chartMarginBottom, left: chartMarginLeft},
		width = chartWidth - margin.left - margin.right,
		height = chartHeight - margin.top - margin.bottom;
	// x-scale
	var x = d3.scale.ordinal()
		.domain(d3.range(m))
		.rangeBands([0, width], 0.08);
	// y-scale
	var y = d3.scale.linear()
		.domain([0, yGroupMax])
		.range([height, 0]);
	// Array of colour values
	var color = d3.scale.linear()
		.domain([0, n - 1])
		.range(["#aad", "#556"]);
	// x-axis
	var xAxis = d3.svg.axis()
		.scale(x)
		.tickSize(0)
		.tickPadding(6)
		.orient("bottom");
	// y-axis
	var yAxis = d3.svg.axis()
	    .scale(y)
		.tickSize(0)
		.tickPadding(6)
	    .orient("left")
	    .ticks(numTics);
	// Create SVG element
	var svgElement = d3.select(parent).insert("svg",function() {return nextSibling;})
		.attr("viewBox", "0 0 960 10")
		.attr("preserveAspectRatio", "xMinYMin meet")
		.attr("width", width + margin.left + margin.right)
		.attr("height", height + margin.top + margin.bottom);
	// Create main group
	var mainGroup = svgElement.append("g")
		.attr("transform", "translate(" + margin.left + "," + margin.top + ")");
	// Create the layers
	var layer = mainGroup.selectAll(".layer")
		.data(layers)
	.enter().append("g")
		.attr("class", "layer")
		.style("fill", function(d, i) { return color(i); });
	// Create the rectangles in each layer
	var rect = layer.selectAll("rect")
		.data(function(d) { return d; })
	.enter().append("rect")
		.attr("x", function(d) { return x(d.x); })
		.attr("y", height)
		.attr("width", x.rangeBand())
		.attr("height", 0);
	// Transition the rectangles to their final height
	rect.transition()
		.delay(function(d, i) { return i * 10; })
		.attr("y", function(d) { return y(d.y); })
		.attr("height", function(d) { return y(d.y); });
	// Add to the DOM
	mainGroup.append("g")
		.attr("class", "x axis")
		.attr("transform", "translate(0," + height + ")")
		.call(xAxis)
	  .append("text")
	  	.attr("transform", "translate(0, 30)")
	  	//.style("text-anchor", "end")
	  	.text(this.Xlabel);
	mainGroup.append("g")
	    .attr("class", "y axis")
	    .call(yAxis)
	  .append("text")
	    .attr("transform", "rotate(-90)")
	    .attr("y", 6)
	    .attr("dy", ".71em")
	    .style("text-anchor", "end")
	    .text(this.Ylabel);
	var self = this;
	// Return the svg node
	return {
		domNode: svgElement[0][0],
		updateChart: function() {
			if (self.barGrouped !== "no") {
				transitionGrouped();
			} else {
				transitionStacked();
			}
		}
	};

	function transitionGrouped() {
		y.domain([0, yGroupMax]);
		rect.transition()
			.duration(chartTransitionDuration)
			.delay(function(d, i) { return i * 10; })
			.attr("x", function(d, i, j) { return x(d.x) + x.rangeBand() / n * j; })
			.attr("width", x.rangeBand() / n)
			.transition()
			.attr("y", function(d) { return y(0+d.y); })
			.attr("height", function(d) { return y(0)-y(d.y); })
	}

/*
	function transitionGrouped() {
		y.domain([yGroupMax, 0]);
		rect.transition()
			.duration(chartTransitionDuration)
			.delay(function(d, i) { return i * 10; })
			.attr("x", function(d, i, j) { return x(d.x) + x.rangeBand() / n * j; })
			.attr("width", x.rangeBand() / n)
			.transition()
			.attr("y", function(d) { return y(0+d.y); })
			.attr("height", function(d) { return y(0)-y(d.y); })
	}
*/

		function transitionStacked() {
			y.domain([yStackMax,0]);
			rect.transition()
			.duration(chartTransitionDuration)
			.delay(function(d, i) { return i * 10; })
			.attr("y", function(d) { return y(0+d.y); })
			.attr("height", function(d) { return y(0)-y(d.y); })
			.transition()
			.attr("x", function(d) { return x(d.x); })
			.attr("width", x.rangeBand());
	}

};

/*
Compute the internal state of the widget
*/
BarWidget.prototype.execute = function() {
	// Get the parameters from the attributes
	this.chartName = this.getAttribute("name");
	this.barData = this.getAttribute("datasets");
	this.settingsTiddler = this.getAttribute("settings");
	this.barGrouped = this.getAttribute("grouped","yes");
};

/*
Selectively refreshes the widget if needed. Returns true if the widget or any of its children needed re-rendering
*/
BarWidget.prototype.refresh = function(changedTiddlers) {
	var changedAttributes = this.computeAttributes();
	var data = this.wiki.getTiddlerData(this.barData);
	for(var name in data) {
		if(changedTiddlers[name]) {
			this.refreshSelf();
			return true;
		}
	}
	if(changedAttributes.data || changedTiddlers[this.barData] || changedTiddlers[this.settingsTiddler]) {
		this.refreshSelf();
		return true;
	} else if(changedAttributes.grouped) {
		this.execute();
		if(this.updateChart) {
			this.updateChart();
		}
		return true;
	}
	return false;
};

exports.d3bar = BarWidget;

})();
