const {ipcMain, BrowserWindow} = require('electron').remote;
const path = require('path');
const {ipcRenderer} = require('electron');
var points = []
var _ready_points = {};
ipcRenderer.send('ask-map-data', true);
ipcRenderer.on('return-map-data', (event, data) => {
  points.push(data);
})
ipcRenderer.on('finished-map-data', (event, data) => {
  addPoints(points);
})

const position = [51.505, -0.09]
const map = L.map('map').setView(position, 3)

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map)

var popup = L.popup({"maxHeight": 150})

function onMapClick(e) {
  let lat = e.lat
  let lng = e.lng
	popup
		.setLatLng(e.latlng)
		.setContent(_ready_points[{"lat": lat, "lon": lng}])
		.openOn(map);
}

map.on('click', onMapClick);

function addPoints(points) {
  for (let i = 0; i < points.length; i++) {
    var user = points[i]["user"];
    var marks = points[i]["geo_point"];
    for (let u = 0; u < marks.length; u++) {
      var lat = marks[u]["lat"];
      var lon = marks[u]["lon"];
      if (_ready_points[marks[u]]) {
        _ready_points[marks[u]] += "<br />" + user
      } else {
        _ready_points[marks[u]] = user
      }
      L.marker([lat, lon])
       .addTo(map)
      var popup = L.popup({"maxHeight": 150})
       .setLatLng([lat, lon])
       .setContent(_ready_points[marks[u]])
  }
}
}
