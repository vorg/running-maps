var fs = require('fs');
var plask = require('plask');
var sax = require("./js/sax/sax");

eval(fs.readFileSync('js/QuadTree/src/QuadTree.js', 'utf8'));

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
    p.x -= this.width/2;// + 150;
    p.y -= this.height/2;// + 50;    
    
    var s = 1;
    p.x *= s;
    p.y *= s;
    
    p.x += this.width/2;
    p.y += this.height/2;    
        
    return p;    
  },
  //returns distance in KM
  arcDist: function(lat1, lon1, lat2, lon2) {
    return 6378.7 * Math.acos(Math.sin(lat1/57.2958) * Math.sin(lat2/57.2958) + Math.cos(lat1/57.2958) * Math.cos(lat2/57.2958) *  Math.cos(lon2/57.2958 - lon1/57.2958));
  },
  isInView: function(point) {
    var m = 10; //margin
    return (point.x > 0 + m && point.x < this.width - m && point.y > m && point.y < this.height - m);
  },
  loadStreetData: function() {
    var self = this;
    fs.readFile("data/frederiksberg.json", function(err, dataStr) {
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
      
      var avgLen = 0.03985220753148917;
      var avgSubsegmentLen = avgLen / 4;
      self.ways.forEach(function(way) {    
        for(var i=0; i<way.path.length-1; i++) {
          var point = way.path[i];
          var nextPoint = way.path[i+1];
          var dist = self.arcDist(point.lat, point.lon, nextPoint.lat, nextPoint.lon);
          if (!isNaN(dist)) {
            var numNewPoints = Math.floor(dist / avgSubsegmentLen);
            if (numNewPoints > 1) {
              var newPoints = [];
              var step = j/numNewPoints;
              for(var j=1; j<numNewPoints; j++) {
                var k = j/numNewPoints;
                var p = {
                  x: point.x + (nextPoint.x - point.x) * k,
                  y: point.y + (nextPoint.y - point.y) * k,
                  sub: true 
                };
                way.path.splice(i, 0, p);
                i++
              }
            }
          }          
        }
      });
      
      self.quadTree = new QuadTree({x:0, y:0, width:self.width, height:self.height}, true, 2);
      self.ways.forEach(function(way) {    
        for(var i=0; i<way.path.length-1; i++) {
          self.quadTree.insert(way.path[i]);
        }
      });
      
      console.log("Bounds : " + self.bounds.length)
      console.log("Ways : " + self.ways.length);
      console.log("Avg Segment Len : " + avgLen);
      
      self.loadRunData();
    });
  },
  parseRun: function(dataStr) {
    dataStr = "" + dataStr;
    var dataArr = dataStr.split(" ");
    var points = [];
    for(var i=0; i<dataArr.length; i++) {
      var keep = false;
      
      if (i > 0 && i < 600) keep = true;
      if (i > 3200 && i < 3900) keep = true;      
      //if (i > 0 && i < 300) keep = true;
      keep = true;
      
      if (!keep) continue;
      
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
    this.matchRunToPath(points);
  },
  matchRunToPath: function(points) {
    for(var i=0; i<points.length; i++) {
      var p = points[i];
      p.closesPoint = this.findClosesPoint(p);
    }
  },
  findClosesPoint: function(p) {
    var neighborPoints = this.quadTree.retrieve(p);
    var minSqDist = 9999999999;
    var neighbor = null;
    for(var i=0; i<neighborPoints.length; i++) {
      var np = neighborPoints[i];
      var sqDist = (np.x - p.x)*(np.x - p.x) + (np.y - p.y)*(np.y - p.y);
      if (sqDist < minSqDist) {
        minSqDist = sqDist;
        neighbor = np;
      }
    }
    return neighbor;    
  },
  loadRunData: function() {    
    var self = this;
    fs.readFile("data/110426-1630-Untitled.txt", function(err, dataStr) {
      self.parseRun(dataStr);
    });
    fs.readFile("data/110529-1505-Untitled.txt", function(err, dataStr) {
      self.parseRun(dataStr);
    });
    fs.readFile("data/110716-1410-Untitled.txt", function(err, dataStr) {
      self.parseRun(dataStr);
    });
    fs.readFile("data/110716-1739-Untitled.txt", function(err, dataStr) {
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
        if (drawLines && self.isInView(point) && self.isInView(nextPoint)) {
          paint.setColor(100, 200, 255, 255);
          canvas.drawLine(paint, point.x, point.y, nextPoint.x, nextPoint.y);
          if (point.sub) {
            paint.setColor(255, 255, 0, 100);    
          }
          canvas.drawCircle(paint, point.x, point.y, 0.5);
        }
        else {
          if (self.isInView(point)) {
            paint.setColor(255, 0, 0, 100);
            canvas.drawCircle(paint, point.x, point.y, 0.5);
                        
            if (point.closesPoint) {
              paint.setColor(0, 255, 0, 250);  
              canvas.drawLine(paint, point.x, point.y, point.closesPoint.x, point.closesPoint.y)
            }
            pointsOfInterest++;
          }
        }
      }
    }
    
    paint.setStyle(paint.kStrokeStyle);
        
    drawPath(this.bounds);
            
    for(var i=0; i<this.ways.length; i++) {
      drawPath(this.ways[i].path);
    }    
    
    for(var i=0; i<this.runs.length; i++) {
      drawPath(this.runs[i], false);
    }
    
    if (this.quadTree) {
      paint.setColor(0, 255, 0, 50);
      this.drawNode(canvas, paint, this.quadTree.root);
    }
    
    paint.setStyle(paint.kFillStyle);
    paint.setColor(255, 255, 255, 255);
    canvas.drawText(paint, "" + pointsOfInterest, 20, 25);
    
    
  },
  drawNode: function(canvas, paint, node) {
  	var bounds = node._bounds;
  	
  	canvas.drawRect(paint, Math.floor(bounds.x)  + 0.5, Math.floor(bounds.y) + 0.5, Math.floor(bounds.x)  + bounds.width, Math.floor(bounds.y)  + bounds.height)

  	for(var i = 0; i <node.nodes.length; i++) {
  		this.drawNode(canvas, paint, node.nodes[i]);
  	}
  }
});
