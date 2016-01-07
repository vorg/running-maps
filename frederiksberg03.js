var fs = require('fs');
var plask = require('plask');
var sax = require("./js/sax/sax");

eval(fs.readFileSync('./js/QuadTree/src/QuadTree.js', 'utf8'));

plask.simpleWindow({ 
  settings: {
    width: 1280,
    height: 720,
    title: "Frederiksberg",
  },
  //E 12 lon
  //N 55 lat  
  bounds: [],
  ways: [],
  runs: [],
  mousePos: {x:0, y:0},
  latLonToXY: function(lat, lon) {
     return {
       lon: lon,
       lat: lat,
        x : (this.width - this.height - 20)/2 + this.height * (lon - min.lon)/(max.lon - min.lon),
        y : 10.1 + (this.height - 20) - (this.height - 20) * (lat - min.lat)/(max.lat - min.lat)
      }
  },
  addXYFromLatLon: function(p) {    
    p.x = (this.width - this.height - 20)/2 + this.height * (p.lon - this.min.lon)/(this.max.lon - this.min.lon);
    p.y = 10.1 + (this.height - 20) - (this.height - 20) * (p.lat - this.min.lat)/(this.max.lat - this.min.lat);
    p.x -= this.width/2 + 150;
    p.y -= this.height/2 + 50;    
    
    var s = 5;
    p.x *= s;
    p.y *= s;
    
    p.x += this.width/2;
    p.y += this.height/2;    
        
    return p;    
  },
  //returns distance in KM
  arcDist: function(lat1, lat2, lon1, lon2) {
    return 6378.7 * Math.acos(Math.sin(lat1/57.2958) * Math.sin(lat2/57.2958) + Math.cos(lat1/57.2958) * Math.cos(lat2/57.2958) *  Math.cos(lon2/57.2958 - lon1/57.2958));
  },
  loadStreetData: function() {
    var self = this;
    fs.readFile("frederiksberg.json", function(err, dataStr) {
      var data = JSON.parse(dataStr);
      
      console.log("loading complete");
      
      self.min = {lat:99999, lon:99999};
      self.max = {lat:-99999, lon:-99999};
      
      data.bounds.forEach(function(p) {        
        if (self.min.lat > p.lat) self.min.lat = p.lat; 
        if (self.max.lat < p.lat) self.max.lat = p.lat; 
        if (self.min.lon > p.lon) self.min.lon = p.lon; 
        if (self.max.lon < p.lon) self.max.lon = p.lon; 
      });                                               
      
      self.bounds = data.bounds.map(function(p) {    
        return self.addXYFromLatLon(p);
      });
      
      self.ways = data.ways.map(function(way) {    
        for(var i=0; i<way.path.length; i++) {
          self.addXYFromLatLon(way.path[i]);
        }
        return way;
      });
      
      console.log("Bounds : " + self.bounds.length)
      console.log("Ways : " + self.ways.length);
      
      self.loadRunData();
    });
  },
  parseRun: function(dataStr) {
    dataStr = "" + dataStr;
    var dataArr = dataStr.split(" ");
    var points = [];
    for(var i=0; i<dataArr.length; i++) {
      var pointArr = dataArr[i].split(",");
      var point = {
        lat: pointArr[1],
        lon: pointArr[0]
      };
      this.addXYFromLatLon(point);
      points.push(point);
    }
    this.runs.push(points);
    
    console.log("Run " + this.runs.length + " : " + points.length)
    
  },
  loadRunData: function() {    
    var self = this;
    fs.readFile("data/run1.txt", function(err, dataStr) {
      self.parseRun(dataStr);
    });
    fs.readFile("data/run2.txt", function(err, dataStr) {
      self.parseRun(dataStr);
    });
  },
  init: function() {    
    this.framerate(10);
    
    this.on('mouseMoved', function(e) {      
      this.mousePos.x = e.x;
      this.mousePos.y = e.y;
    });
    
    this.loadStreetData();
  },  
  draw: function() {
    var canvas = this.canvas, paint = this.paint;
    canvas.drawColor(0, 0, 0, 255);
    
    var self = this;
    var pointsOfInterest = 0;
        
    function drawPath(points, drawLines) {
      if (drawLines === undefined) drawLines = true;
      for(var i=0; i<points.length - 1; i++) {        
        var point = points[i];
        var nextPoint = points[i+1];        
        if (drawLines) {
          canvas.drawLine(paint, point.x, point.y, nextPoint.x, nextPoint.y);
          canvas.drawCircle(paint, point.x, point.y, 2);
        }
        else {
          var m = 10; //margin
          if (point.x > 0 + m && point.x < self.width - m && point.y > m && point.y < self.height - m) {
            canvas.drawCircle(paint, point.x, point.y, 1);
            pointsOfInterest++;
          }
        }
      }
    }
    
    paint.setStyle(paint.kStrokeStyle);
    
    paint.setColor(255, 255, 255, 255);    
    drawPath(this.bounds);
        
    paint.setColor(100, 200, 255, 255);        
    for(var i=0; i<this.ways.length; i++) {
      drawPath(this.ways[i].path);
    }
    
    paint.setColor(255, 0, 0, 255);
    for(var i=0; i<this.runs.length; i++) {
      drawPath(this.runs[i], false);
    }
    
    paint.setStyle(paint.kFillStyle);
    paint.setColor(255, 255, 255, 255);
    canvas.drawText(paint, "" + pointsOfInterest, 20, 25);
    
  }
});
