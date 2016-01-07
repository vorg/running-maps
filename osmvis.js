var fs = require('fs');
var plask = require('plask');
var sax = require("./js/sax/sax.js");

function readFile(file) {
  file = __dirname + "/" + file;
	var size = fs.statSync(file).size,
		buf = new Buffer(size),
		fd = fs.openSync(file, 'r');
	if (!size)
		return "";
	fs.readSync(fd, buf, 0, size, 0);
	fs.closeSync(fd);
	return buf.toString();
} 


plask.simpleWindow({ 
  settings: {
    width: 1280,
    height: 720,
    title: "Frederiksberg",
  },
  //E 12 lon
  //N 55 lat  
  points: [],
  nodes: [],
  ways: [],
  run: [],
  mousePos: {x:0, y:0},
  lonLatToXY: function(lon, lat) {
     return {
       lon: lon,
       lat: lat,
        x : (this.width - this.height - 20)/2 + this.height * (lon - min.lon)/(max.lon - min.lon),
        y : 10.1 + (this.height - 20) - (this.height - 20) * (lat - min.lat)/(max.lat - min.lat)
      }
  },
  getNodeById: function(id) {
    
  },
  init: function() {    
    this.framerate(10);
    
    this.on('mouseMoved', function(e) {      
      this.mousePos.x = e.x;
      this.mousePos.y = e.y;
    });
    
    var self = this;
    
    var frederiksbergData = readFile("data/frederiksberg.osm");
    var parser = sax.parser(true);
    var lastWay = null;
    
    parser.onerror = function (e) {
      // an error happened.
    };
    parser.ontext = function (t) {
      // got some text.  t is the string of text.
    };
    parser.onopentag = function (node) {
      if (node.name == "node") {      
        self.nodes.push({
          id: node.attributes.id,
          lat: node.attributes.lat,
          lon: node.attributes.lon,
        });
        lastWay = null;
      }
      else if (node.name == "way") {
        lastWay = {
          id: node.attributes.id,
          nodes: []
        };
      }
      else if (node.name == "nd") {
        if (lastWay) {
          lastWay.nodes.push(node.attributes.ref);          
        }
      }
      else if (node.name == "tag") {
        if (lastWay) {
          if (node.attributes.k == "order") { //highway
            self.ways.push(lastWay);
          }
        }
      }
      // opened a tag.  node has "name" and "attributes"
    };
    parser.onclosetag = function (node) {
      if (node.name == "way") {
        lastWay = null;
      }
    };    
    parser.onattribute = function (attr) {
      // an attribute.  attr has "name" and "value"
    };
    parser.onend = function () {      
    };

    parser.write(frederiksbergData).close();
    
    //console.log(this.ways);
    
    //var doc = xml.parseFromString();
    //var elem = doc.documentElement;
    
    var self = this;
    
    var runData = JSON.parse(readFile("data/run.json"));
    self.run = runData.plusService.route.waypointList;
    
    fs.readFile('data/frederiksberg.txt', 'utf-8', function (err, data) {
      var lines = data.split(" ");
      var min = {lat:99999, lon:99999};
      var max = {lat:-99999, lon:-99999};      
      self.points = lines.map(function(line) {
        return line.split(",").map(function(d) {
          return Number(d);
        });
      });    
      self.points.forEach(function(p) {        
        if (min.lon > p[0]) min.lon = p[0];
        if (min.lat > p[1]) min.lat = p[1];        
        if (max.lon < p[0]) max.lon = p[0];
        if (max.lat < p[1]) max.lat = p[1]; 
        //console.log("\t" + p[0] + " " + p[1]);
      })
      
      this.min = min;
      this.max = max;
      
      self.points = self.points.map(function(p) {
        return self.lonLatToXY(p[0], p[1]);
      });
      
      self.nodes = self.nodes.map(function(node) {
        var nodepos = self.lonLatToXY(node.lon, node.lat);
        nodepos.id = node.id;
        return nodepos;
      });
      
      for(var i=0; i<self.ways.length; i++) {
        var way = self.ways[i];      
        var broken = false;
        for(var j=0; j<way.nodes.length; j++) {
          var nodeId = way.nodes[j];
          var found = false;
          for(var k=0; k<self.nodes.length; k++) {
            if (self.nodes[k].id == nodeId) {
              way.nodes[j] = self.nodes[k];
              found = true;
              self.nodes[k].used = true;
              break;
            }
          }
          if (!found) {
            broken = true;
            way.invalid = true;
            break;
          }
        }
      }
      
      var runLength = 0;
      for(var i=0; i<self.run.length-1; i++) {
        runLength += self.arcDist(self.run[i].lat, self.run[i+1].lat, self.run[i].lon, self.run[i+1].lon);
      }
      console.log("Run length: " + runLength);
      
      self.run = self.run.map(function(point) {
        return self.lonLatToXY(point.lon, point.lat);
      });
      
      console.log("Nodes: " + self.nodes.length);
      console.log("Ways: " + self.ways.length);
      console.log("Run waypoints: " + self.run.length);
      console.log("QuadTree:");
      //console.log(self.quadTree.root);
      
    });
  },
  //returns distance in KM
  arcDist: function(lat1, lat2, lon1, lon2) {
    return 6378.7 * Math.acos(Math.sin(lat1/57.2958) * Math.sin(lat2/57.2958) + Math.cos(lat1/57.2958) * Math.cos(lat2/57.2958) *  Math.cos(lon2/57.2958 - lon1/57.2958));
  },
  draw: function() {
    var canvas = this.canvas, paint = this.paint;
  
    canvas.drawColor(0, 0, 0, 255);
    
    //paint.setFlags(paint.kAntiAliasFlag);
    
    for(var i=0; i<this.nodes.length; i++) {
      this.nodes[i].selected = false;   
    }
        
    paint.setColor(50, 50, 50, 255);
    var neighborPoints = [];

    paint.setStyle(paint.kStrokeStyle);
    paint.setColor(255, 255, 255, 255);
    if (this.points.length > 0) {      
      for(var i=0; i<this.points.length; i++) {
        var point = this.points[i];
        var nextPoint = this.points[(i+1) % this.points.length];        
        canvas.drawLine(paint, point.x, point.y, nextPoint.x, nextPoint.y);
      }
    }
    
    paint.setStyle(paint.kStrokeStyle);
    
    if (this.ways.length > 0) {    
      
      var totalStreetLength = 0;
        
      for(var i=0; i<this.ways.length; i++) {
        var way = this.ways[i];
        
        //if (way.invalid === true) paint.setColor(255, 255, 100, 150);//continue;     
        //else paint.setColor(100, 200, 255, 150);
        
        if (way.invalid) continue;
        
        var selected = false;
        for(var j=0; j<way.nodes.length-1; j++) {
          if (way.nodes[j].selected) {
            selected = true;
            break;
          }
        }
        
        if (selected) paint.setColor(255, 255, 100, 150);//continue;     
        else paint.setColor(100, 200, 255, 150);
        
        for(var j=0; j<way.nodes.length-1; j++) {
          var point = way.nodes[j];          
          var nextPoint = way.nodes[j+1];                    
          var wayLen = this.arcDist(point.lat, nextPoint.lat, point.lon, nextPoint.lon);
          //console.log(wayLen);
          totalStreetLength += wayLen;
          canvas.drawLine(paint, point.x, point.y, nextPoint.x, nextPoint.y);
        }        
      }
      
      if (this.frameid < 20) {
        console.log("Total Street Length : " + totalStreetLength);
      }
    }
    
    paint.setColor(255, 0, 0, 150);//continue;     
    if (this.run.length > 0) {      
      for(var i=0; i<this.run.length-1; i++) {
          var point = this.run[i];
          var nextPoint = this.run[i+1];              
          canvas.drawLine(paint, point.x, point.y, nextPoint.x, nextPoint.y);
      }        
    }
    
    //paint.setStyle(paint.kFillStyle);
    
    if (this.nodes.length > 0) {      
      for(var i=0; i<this.nodes.length; i++) {
        var node = this.nodes[i];   
        if (node.used !== true) continue;     
        if (node.selected) 
          paint.setColor(255, 255, 0, 100);
        else  
          paint.setColor(0, 255, 200, 100);
        canvas.drawCircle(paint, node.x, node.y, 1);
      }
    }
    
    
  }
});
