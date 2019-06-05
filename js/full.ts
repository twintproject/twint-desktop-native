var elasticsearch = require('elasticsearch');
var ElasticsearchScrollStream = require('elasticsearch-scroll-stream');
var Heap = require('heap');
var Chart = require('chart.js');

import { remote } from 'electron';
const BrowserWindow = remote.BrowserWindow;
const ipcMain = remote.ipcMain;
import * as path from 'path';
import * as notifier from 'node-notifier';

let connectPage: string = "../pages/form.html";
let customTemplatePage: string = "../pages/customTemplate.html";
let graphPage: string = "../pages/graph0.html";
let mapPage: string = "../maps/map0.html";
let wordcloudPage: string = "../pages/wordCloud.html";
let progresserPage: string = "../pages/progress.html";

function generateRandomNumber(): Array<string> {
  let rc: Array<string> = [Math.floor(Math.random() * 255).toString(),
                           Math.floor(Math.random() * 255).toString(),
                           Math.floor(Math.random() * 255).toString()]
  return rc
}

function generateColors(): [Array<string>, Array<string>] {
  let backgroundColor = [];
  let borderColor = [];
  let rc: Array<string> = generateRandomNumber();
  for ( let i = 0; i < 7; i++) {
    backgroundColor.push("rgba("+rc[0]+","+rc[1]+","+rc[2]+",0.2)")
    borderColor.push("rgba("+rc[0]+","+rc[1]+","+rc[2]+",1)")
  }
  return [backgroundColor, borderColor]
}

function openWindow(windowName: string, winzoz: any, page: string): void {
  winzoz.Load(windowName, page);
};

function openConnectorForm() {
  openWindow("winConnect", winzoz, connectPage)
}

function openCustomTemplate() {
  openWindow("winCustomTemplate", winzoz, customTemplatePage)
}

function openGraph() {
  openWindow("winGraph", winzoz, graphPage)
}

function openMap() {
  openWindow("winMap", winzoz, mapPage)
}

function openWordCloud() {
  openWindow("winWordCloud", winzoz, wordcloudPage)
}

function openProgresserPage() {
  openWindow("winProgresser", winzoz, progresserPage)
}

function hideProgresserPage() {
  winzoz.Hide("winProgresser")
}

class Elastic {
  protocol: string;
  hostname: string;
  port: number;
  index: string;
  type: string;
  size: string;
  scroll: string;
  client: any;
  maxItems: number;

  constructor(protocol: string, hostname: string, port: number, index: string,
    type: string, size: string, scroll: string, maxItems: number = 0) {
    this.protocol = protocol;
    this.hostname = hostname;
    this.port = port;
    this.index = index;
    this.type = type;
    this.size = size;
    this.scroll = scroll;
    this.maxItems = maxItems;
  }

  newClient(): void {
    this.client = new elasticsearch.Client({
      host: [{
        host: this.hostname,
        port: this.port,
        protocol: this.protocol,
        log: 'trace'
      }]
    })
  }

  singleSearch(body: object, graphData: object[]): object[] {
    this.client.search({
      index: this.index,
      type: this.type,
      size: '1',
      body: body,
      ignore: [404]
    }).then(function(resp) {
      if (resp.hits.hits.length > 0) {
        var current_doc = resp.hits.hits[0]["_source"];
        graphData.push({
          "username": current_doc["username"],
          "hashtags": current_doc["hashtags"]
        })
      }
    })
    return graphData
  }

  scrollSearch(body: object, totalDatasets: any, charts: any): void {
    let stream = new ElasticsearchScrollStream(this.client, {
      index: this.index,
      type: this.type,
      scroll: this.scroll,
      size: this.size,
      body: body
    });
    let counter: number = 0;
    let maxItems = this.maxItems;

    openProgresserPage();

    stream.on('data', function(data) {
      counter++;
      let currentDoc: object = JSON.parse(data.toString());
      if (!totalDatasets.dataset[currentDoc["username"]]) {
        totalDatasets.dataset[currentDoc["username"]] =
          {
            "value": 1,
            "hashtags": {},
            "days": {},
            "hours": {},
            "tweets": [currentDoc["tweet"]]
          }
        try {
          if (typeof currentDoc["geo_tweet"] !== 'undefined') {
            totalDatasets.dataset[currentDoc["username"]]["geo_point"] = [currentDoc["geo_tweet"]];
          }
          if (typeof currentDoc["geo_near"] !== 'undefined') {
            totalDatasets.dataset[currentDoc["username"]]["geo_point"] = [currentDoc["geo_near"]];
          }
        } catch (err) { ; }
      } else {
        totalDatasets.dataset[currentDoc["username"]]["value"]++;
        totalDatasets.dataset[currentDoc["username"]]["tweets"].push(currentDoc["tweet"]);
        try {
          if (typeof currentDoc["geo_tweet"] !== 'undefined') {
            totalDatasets.dataset[currentDoc["username"]]["geo_point"].push(currentDoc["geo_tweet"]);
          }
          if (typeof currentDoc["geo_near"] !== 'undefined') {
            totalDatasets.dataset[currentDoc["username"]]["geo_point"].push(currentDoc["geo_near"]);
          }
        } catch (err) { ; }
      }
      if (!totalDatasets.dataset[currentDoc["username"]]["days"][currentDoc["day"]]) {
        totalDatasets.dataset[currentDoc["username"]]["days"][currentDoc["day"]] = 1;
      } else {
        totalDatasets.dataset[currentDoc["username"]]["days"][currentDoc["day"]]++;
      }
      if (!totalDatasets.dataset[currentDoc["username"]]["hours"][currentDoc["hour"]]) {
        totalDatasets.dataset[currentDoc["username"]]["hours"][parseInt(currentDoc["hour"])] = 1;
      } else {
        totalDatasets.dataset[currentDoc["username"]]["hours"][parseInt(currentDoc["hour"])]++;
      }
      for (let i = 0; i < currentDoc["hashtags"].length; i++) {
        if (!totalDatasets.dataset[currentDoc["username"]]["hashtags"][currentDoc["hashtags"][i]]) {
          totalDatasets.dataset[currentDoc["username"]]["hashtags"][currentDoc["hashtags"][i]] = 1
        } else {
          totalDatasets.dataset[currentDoc["username"]]["hashtags"][currentDoc["hashtags"][i]]++
        }
      }
      if (counter == maxItems && maxItems > 0) {
        stream.close();
      }
    })

    stream.on('end', function() {
      hideProgresserPage();
      totalDatasets.prepareHeaps(10, 10);
      totalDatasets.fillOtherCharts(charts.barChart, charts.lineChart, charts.pieChart)
      totalDatasets.fillRadarChart(charts.radarChart)
      totalDatasets.fillMapPoints()
      totalDatasets.fillTweetsCloud()
    })
  }
}

class browserWindows {
  winConnect: Electron.BrowserWindow;
  winCustomTemplate: Electron.BrowserWindow;
  winProgresser: Electron.BrowserWindow;
  winGraph: Electron.BrowserWindow;
  winMap: Electron.BrowserWindow;
  winWordCloud: Electron.BrowserWindow;

  settings: object;
  windows: object;

  constructor() {
    this.settings = {};
    this.windows = {};
    this.winConnect;
    this.winCustomTemplate;
    this.winProgresser;
    this.winGraph;
    this.winMap;
    this.winWordCloud;
    this.settings["winConnect"] = {
      width: 300,
      height: 400,
      autoHideMenuBar: true,
      frame: false,
      show: false,
      resizable: false,
    };
    this.winConnect = new BrowserWindow(this.settings["winConnect"]);
    this.windows["winConnect"] = this.winConnect;
    this.settings["winCustomTemplate"] = {
      width: 300,
      height: 300,
      autoHideMenuBar: true,
      frame: false,
      show: false,
      resizable: false,
    };
    this.winCustomTemplate = new BrowserWindow(this.settings["winCustomTemplate"]);
    this.windows["winCustomTemplate"] = this.winCustomTemplate;
    this.settings["winProgresser"] = {
      width: 200,
      height: 200,
      autoHideMenuBar: true,
      frame: false,
      show: false,
      resizable: false,
    };
    this.winProgresser = new BrowserWindow(this.settings["winProgresser"]);
    this.windows["winProgresser"] = this.winProgresser;
    this.settings["winGraph"] = {
      width: 1000,
      height: 800,
      autoHideMenuBar: true,
      frame: true,
      show: false,
      resizable: true,
    }
    this.winGraph = new BrowserWindow(this.settings["winGraph"]);
    this.windows["winGraph"] = this.winGraph;
    this.settings["winMap"] = {
      width: 1000,
      height: 800,
      autoHideMenuBar: true,
      frame: true,
      show: false,
      resizable: true,
    };
    this.winMap = new BrowserWindow(this.settings["winMap"]);
    this.windows["winMap"] = this.winMap;
    this.settings["winWordCloud"] = {
      width: 600,
      height: 400,
      autoHideMenuBar: true,
      frame: true,
      show: false,
      resizable: true,
    };
    this.winWordCloud = new BrowserWindow(this.settings["winWordCloud"]);
    this.windows["winWordCloud"] = this.winWordCloud;
  }


  private regenerate(name: string): void {
    let _window = new BrowserWindow(this.settings[name]);
    this.windows[name] = _window;
  }

  private call(name: string, page: string): void {
    this.windows[name].loadURL(path.join('file://', __dirname, page));
    this.windows[name].show();
  }

  Load(name: string, page: string): void {
    try {
      this.call(name, page)
    } catch (err) {
      this.regenerate(name);
      this.call(name, page)
    }
  }

  Hide(name: string) {
    this.windows[name].hide();
  }
}

class Charts {
  barChart: any;
  lineChart: any;
  pieChart: any;
  radarChart: any;

  constructor() {}

  genereateBarChart(ctxBarChart: any): void {
    this.barChart = new Chart(ctxBarChart, {
      type: 'bar',
      mode: 'x',
      intersect: false,
      data: {
        labels: [1,2,3,4,5,6,7],
        datasets: []
      },
      options: {
        responsive: true,
        scales: {
          yAxes: [{
            display: true,
            scaleLabel: {
              display: true,
              labelString: 'Tweets'
            },
            ticks: {
              beginAtZero: true
            }
          }]
        }
      }
    })
  }

  generateLineChart(ctxLineChart: any): void {
    this.lineChart = new Chart(ctxLineChart, {
      type: 'line',
      data: {
        labels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
          22, 23
        ],
        datasets: []
      },
      options: {
        legend: {
          display: true
        },
        onClick: (data) => {
          console.log(data)
        },
        responsive: true,
        tooltips: {
          mode: 'index',
          intersect: false,
        },
        hover: {
          mode: 'nearest',
          intersect: true
        },
        scales: {
          xAxes: [{
            display: true,
            scaleLabel: {
              display: true,
              labelString: 'Hours'
            }
          }],
          yAxes: [{
            display: true,
            scaleLabel: {
              display: true,
              labelString: 'Tweets'
            }
          }]
        }
      }
    });
  }

  generatePieChart(ctxPieChart: any): void {
    this.pieChart = new Chart(ctxPieChart, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [1],
          backgroundColor: ['rgba(255, 99, 132, 1)'],
          label: 'users'
        }],
        labels: ["none"]
      },
      options: {
        responsive: true,
        legend: {
          display: true,
          position: 'left'
        }
      }
    });
  }

  generateRadarChart(ctxRadarChart: any): void {
    this.radarChart = new Chart(ctxRadarChart, {
      type: 'radar',
      data: {
        labels: ["none"],
        datasets: [{
          label: 'Hashtags',
          data: [1],
          backgroundColor: [
            'rgba(255, 99, 132, 0.2)',
          ],
          borderColor: [
            'rgba(255, 99, 132, 1)',
          ],
          borderWidth: 1,
          pointBackgroundColor: 'rgba(255, 99, 132, 1)'
        }]
      },
      options: {
        responsive: true,
        legend: {
          display: true,
          position: 'left'
        },
        scale: {
          ticks: {
            beginAtZero: true
          }
        }
      }
    });
  }

}

class fullDataset {
  dataset: object;
  geoPoints: object[];
  tweets: string[];

  private heapUsers: any;
  private heapHashtags: any;

  constructor() {
    this.tweets = [];
    this.geoPoints = [];
    this.dataset = [];
    this.heapUsers = new Heap(function(a, b) {
      return a.value - b.value;
    });
    this.heapHashtags = new Heap(function(a, b) {
      return a.hashtags.value - b.hashtags.value;
    });
  }

  prepareHeaps(maxUsers: number, maxHashtags: number): void {
    let oldHeapHashtags = this.heapHashtags;
    this.heapHashtags = new Heap(function(a, b) {
      return a.hashtags.value - b.hashtags.value;
    });
    this.heapUsers = new Heap(function(a, b) {
      return a.value - b.value;
    });
    let _tempHash = {};
    for (var key in this.dataset) {
      this.heapUsers.push({
        "users":
          { "value": this.dataset[key]["value"], "name": key }
      });
      for (var hash in this.dataset[key]["hashtags"]) {
        if (!_tempHash[hash]) {
          _tempHash[hash] = this.dataset[key]["hashtags"][hash]
        } else {
          _tempHash[hash] += this.dataset[key]["hashtags"][hash]
        }
      }
    }
    for (let i = 0; i < oldHeapHashtags.toArray().size; i++) {
      let hash = oldHeapHashtags.toArray()[i]["hashtags"]["name"];
      let value = oldHeapHashtags.toArray()[i]["hashtags"]["value"];
      if (!_tempHash[hash]) {
        _tempHash[hash] = value
      } else {
        _tempHash[hash] += value
      }
    }
    for (var hash in _tempHash) {
      this.heapHashtags.push({
        "hashtags":
          { "value": _tempHash[hash], "name": hash }
      });
    };
    while ( maxHashtags < this.heapHashtags.size() ){
      this.heapHashtags.pop();
    }
    while ( maxUsers < this.heapUsers.size() ) {
      this.heapUsers.pop();
    }
  }

  fillOtherCharts(barChart: any, lineChart: any, pieChart: any) {
    let totalDays: object = {};
    let totalHours: object = {};
    pieChart.data.datasets[0].data = [];
    pieChart.data.labels = [];
    pieChart.data.datasets[0].backgroundColor = [];
    barChart.data.datasets = [];
    lineChart.data.datasets = [];
    let colors: [Array<string>, Array<string>] = generateColors();
    for (let u = 0; u < this.heapUsers.toArray().length; u++) {
      colors = generateColors();
      var key = this.heapUsers.toArray()[u]["users"]["name"];
      totalDays[key] = {};
      totalHours[key] = {};

      // bar dataset for new user
      var newTargetBar = {
              label: key,
              stack: key,
              data: [],
              backgroundColor: colors[0],
              borderColor: colors[1],
              borderWidth: 1
      };
      barChart.data.datasets.push(newTargetBar);
      //myBarChart.data.datasets.push(newTargetBar);
      var newTargetLine = {
             label: key,
             stack: key,
             backgroundColor: newTargetBar.backgroundColor[0],
             borderColor: newTargetBar.borderColor[0],
             data: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
             fill: false,
      };
      lineChart.data.datasets.push(newTargetLine);
      for (var hash in this.dataset[key]["days"]) {
        if (!totalDays[key][hash]) {
          totalDays[key][hash] = this.dataset[key]["days"][hash]
        } else {
          totalDays[key][hash] += this.dataset[key]["days"][hash]
        }
      }
      for (var hash in totalDays[key]) {
        barChart.data.datasets[u].data[parseInt(hash)-1] = totalDays[key][hash];
      }
      for (var hash in this.dataset[key]["hours"]) {
        if (!totalHours[key][hash]) {
          totalHours[key][hash] = this.dataset[key]["hours"][hash]
        } else {
          totalHours[key][hash] += this.dataset[key]["hours"][hash]
        }
      }
      for (var hash in totalHours[key]) {
        lineChart.data.datasets[u].data[parseInt(hash)] = totalHours[key][hash];
      }
      pieChart.data.labels.push(key);
      pieChart.data.datasets[0].data.push(this.dataset[key]["value"]);
      pieChart.data.datasets[0].backgroundColor.push(colors[1]);
    }
    lineChart.update();
    barChart.update();
    pieChart.update();
  }

  fillRadarChart(radarChart: any): void {
    radarChart.data.labels = [];
    radarChart.data.datasets[0].data = [];
    for (let i = 0; i < this.heapHashtags.toArray().length; i++) {
      radarChart.data.labels.push(this.heapHashtags.toArray()[i]["hashtags"]["name"]);
      radarChart.data.datasets[0].data.push(this.heapHashtags.toArray()[i]["hashtags"]["value"]);
    }
    radarChart.update();
  }

  fillMapPoints() {
    for (var key in this.dataset) {
      if (typeof this.dataset[key]["geo_point"] !== "undefined") {
        this.geoPoints.push({"user": key, "geo_point": this.dataset[key]["geo_point"]});
      }
    }
    console.log(this.geoPoints)
  }

  fillTweetsCloud() {
    for (var key in this.dataset) {
      this.tweets.push(this.dataset[key]["tweets"]);
    }
  }
}


// main
var winzoz = new browserWindows();
let totalDatasets = new fullDataset();
let charts = new Charts();
let ctxBarChart = document.getElementById("myBarChart");
let ctxRadarChart = document.getElementById("myRadarChart");
let ctxPieChart = document.getElementById("myPieChart");
let ctxLineChart = document.getElementById("myLineChart");
charts.generateLineChart(ctxLineChart);
charts.generatePieChart(ctxPieChart);
charts.genereateBarChart(ctxBarChart);
charts.generateRadarChart(ctxRadarChart);

let client: any;
ipcMain.on('post-creds', (event, creds) => {
  let esProto = creds['esProto'];
  let esHost = creds['esHost'];
  let esPort = creds['esPort'];
  let esIndex = creds['esIndex'];
  let esType = creds['esType'];
  winzoz.Hide("winConnect");
  try {
    client = new Elastic(esProto, esHost, esPort, esIndex, esType, "1", "1s");
    client.newClient();
    notifier.notify({
      title: 'Twint Desktop',
      message: 'Connected to Elasticsearch'
    });
    document.getElementById('connector').style.color = 'rgb(79, 243, 161)';
  } catch (err) {
    notifier.notify({
      title: 'Twint Desktop',
      message: 'Error while connecting to Elasticsearch'
    });
    document.getElementById('connector').style.color = 'red';
  }
});

let graphData: object[] = [{}];
ipcMain.on('ask-data-to-graph', (event) => {
  for (let i = 0; i < charts.pieChart.data.labels.length; i++) {
    for (let u = 0; u < charts.radarChart.data.labels.length; u++) {
      var body = {
        query: {
          bool: {
            must: [{
                match: {
                  username: charts.pieChart.data.labels[i]
                }
              },
              {
                match: {
                  hashtags: charts.radarChart.data.labels[u]
                }
              }
            ]
          }
        }
      };
      graphData = client.singleSearch(body, graphData)
    }
  }
  graphData.shift();
  event.sender.send('return-data-to-graph', graphData);
});
ipcMain.on('ask-map-data', (event) => {
  for (let i = 0; i < totalDatasets.geoPoints.length; i++) {
    var entry = totalDatasets.geoPoints[i];
    var obj = {
      "user": entry['user'],
      "geo_point": entry['geo_point']
    }
    console.log(obj)
    event.sender.send('return-map-data', obj);
  }
  event.sender.send('finished-map-data', 'end');
})
ipcMain.on('ask-wordCloud', (event) => {
  for (let i = 0; i < totalDatasets.tweets.length; i++) {
    var entry = totalDatasets.tweets[i];
    event.sender.send('return-cloud-data', entry);
  }
  event.sender.send('finished-cloud-data', true);
})
ipcMain.on('post-template', (event, template) => {
  winzoz.Hide("winCustomTemplate");
  var body = {
    "query": {
      "bool": {
        "should": []
      }
    }
  };
  for (var key in template) {
    if (key == "username") {
      for (let i = 0; i < template[key].split(",").length; i++) {
        body["query"]["bool"]["should"].push({
          "match": {
            "username": template[key].split(",")[i]
          }
        });
      }
    }
    if (key == "hashtags") {
      for (let i = 0; i < template[key].split(",").length; i++) {
        body["query"]["bool"]["should"].push({
          "match": {
            "hashtags": template[key].split(",")[i]
          }
        });
      }
    }
    if (key == "tweet") {
      for (let i = 0; i < template[key].split(",").length; i++) {
        body["query"]["bool"]["should"].push({
          "match": {
            "tweet": template[key].split(",")[i]
          }
        });
      }
    }
  }
  client.scrollSearch(body, totalDatasets, charts)
});
//let elasticInstance = new Elastic("http", "localhost", 9200, "twinttweets", "items", '1', "1s", 100);
let bbody = {
  query: {
    bool: {
      must: [{
        match: {
          username: 'noneprivacy'
        }
      }
      ]
    }
  }
}
