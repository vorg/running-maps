var fs = require('fs');
var plask = require('plask');
var sax = require("./js/sax/sax");

eval(fs.readFileSync('js/QuadTree/src/QuadTree.js', 'utf8'));

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
          path: []
        };
      }
      else if (node.name == "nd") {
        if (lastWay) {
          lastWay.path.push(node.attributes.ref);          
        }
      }
      else if (node.name == "tag") {
        if (lastWay) {
          if (node.attributes.k == "highway") {
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
      
      // self.nodes = self.nodes.map(function(node) {
      //         var nodepos = self.lonLatToXY(node.lon, node.lat);
      //         nodepos.id = node.id;
      //         return nodepos;
      //       });
      
      self.quadTree = new QuadTree({x:0, y:0, width:self.width, height:self.height}, true, 5);
      self.nodes.forEach(function(node) {
        self.quadTree.insert(node);
      });
      
      for(var i=0; i<self.ways.length; i++) {
        console.log(i + " / " + self.ways.length);
        var way = self.ways[i];              
        var broken = false;
        for(var j=0; j<way.path.length; j++) {
          console.log(j + " / " + way.path.length);
          var nodeId = way.path[j];
          var found = false;
          for(var k=0; k<self.nodes.length && k >= 0; k++) {
            if (self.nodes[k].id == nodeId) {
              way.path[j] = {
                lat: self.nodes[k].lat,
                lon: self.nodes[k].lon
              }
              found = true;
              break;
            }
          }
          if (!found) {
            way.path.splice(j, 1);
          }
        }
        if (way.path.length == 0) {
          self.ways.splice(i, 1);
        }
      }
      
      var data = {
        bounds: self.points.map(function(e) { delete e.x; delete e.y; return e;}),
        //nodes: self.nodes.map(function(e) { delete e.x; delete e.y; return e;}),
        ways: self.ways
      }
      fs.writeFileSync("frederiksberg.json", JSON.stringify(data, null, 2));
      
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
      
      self.ready = true;
      
    });
  },
  //returns distance in KM
  arcDist: function(lat1, lat2, lon1, lon2) {
    return 6378.7 * Math.acos(Math.sin(lat1/57.2958) * Math.sin(lat2/57.2958) + Math.cos(lat1/57.2958) * Math.cos(lat2/57.2958) *  Math.cos(lon2/57.2958 - lon1/57.2958));
  },
  draw: function() {
    
  },
  drawNode: function(canvas, paint, node) {
  	var bounds = node._bounds;
  	
  	canvas.drawRect(paint, Math.floor(bounds.x)  + 0.5, Math.floor(bounds.y) + 0.5, Math.floor(bounds.x)  + bounds.width, Math.floor(bounds.y)  + bounds.height)

  	for(var i = 0; i <node.nodes.length; i++) {
  		this.drawNode(canvas, paint, node.nodes[i]);
  	}
  }
});
