function loadData(Body, totalDatasets) {

    winProgresser.loadURL(path.join('file://', __dirname, "/progress.html"));
    winProgresser.show();

    var es_stream = new ElasticsearchScrollStream(client, {
        index: 'twinttweets',
        type: 'items',
        scroll: '2m',
        size: '10000',
        body: Body
        //{
        //    query: {
        //        match: {
        //            username: "noneprivacy"
        //        }
        //    }
        //}
    });


    var totalHashtags = {};
    var totalDays = {};
    var totalHours = {};
    var totalUsers = {};
    var total = {}; // every data here

    es_stream.on('data', function(data) {
        var current_doc = JSON.parse(data.toString());
        if (!total[current_doc["username"]]) {
            total[current_doc["username"]] =
            {
                "value": 1,
                "hashtags": {},
                "days": {},
                "hours": {},
                "tweets": [current_doc["tweet"]]
            }
            try {
                total[current_doc["username"]]["geo_points"] = [current_doc["geo_tweet"]];
            } catch (err) {;}
        } else {
            total[current_doc["username"]]["value"]++;
            total[current_doc["username"]]["tweets"].push(current_doc["tweet"]);
            try {
                total[current_doc["username"]]["geo_points"].push(current_doc["geo_tweet"]);
            } catch (err) {;}
        }
        if (!total[current_doc["username"]]["days"][current_doc["day"]]) {
            total[current_doc["username"]]["days"][current_doc["day"]] = 1;
        } else {
            total[current_doc["username"]]["days"][current_doc["day"]]++;
        }
        if (!total[current_doc["username"]]["hours"][current_doc["hour"]]) {
            total[current_doc["username"]]["hours"][parseInt(current_doc["hour"])] = 1;
        } else {
            total[current_doc["username"]]["hours"][parseInt(current_doc["hour"])]++;
        }
        for (let i = 0; i < current_doc.hashtags.length; i++) {
            if (!total[current_doc["username"]]["hashtags"][current_doc.hashtags[i]]) {
                total[current_doc["username"]]["hashtags"][current_doc.hashtags[i]] = 1
            } else {
                total[current_doc["username"]]["hashtags"][current_doc.hashtags[i]]++
            }
        }
    });


    es_stream.on('end', function() {
        winProgresser.hide();
        var heapHashtags = new Heap(function(a, b) {
            return a.hashtags.value - b.hashtags.value;
        });
        var heapUsers = new Heap(function(a, b) {
            return a.value - b.value;
        });
        if (myBarChart.data.datasets[0].data.length < 7) {
            heapUsers, heapHashtags = iterateOverTotalForHeaps(total, heapUsers, heapHashtags)
            while ( 15 < heapHashtags.size() ){
                heapHashtags.pop();
            }
            while ( 15 < heapUsers.size() ) {
                heapUsers.pop();
            }
            // for radar chart
            myRadarChart.data.labels.pop();
            myRadarChart.data.datasets[0].data.pop();
            for (let i = 0; i < heapHashtags.toArray().length; i++) {
                myRadarChart.data.labels.push(heapHashtags.toArray()[i]["hashtags"]["name"]);
                myRadarChart.data.datasets[0].data.push(heapHashtags.toArray()[i]["hashtags"]["value"]);
            }
            // clean pie chart
            myPieChart.data.datasets[0].data.pop();
            myPieChart.data.labels.pop();
            myPieChart.data.datasets[0].backgroundColor.pop();
            // for bar chart
            myBarChart.data.datasets.pop();
            for (let d = 1; d < 8; d++) {
                myBarChart.data.labels.push(d);
            }
            for (let u = 0; u < heapUsers.toArray().length; u++) {
                var key = heapUsers.toArray()[u]["users"]["name"];
                console.log(total[heapUsers.toArray()[u]["users"]["name"]]);
                totalDays[key] = {};
                totalHours[key] = {};

                // create random colors
                var rc = [Math.floor(Math.random() * 255),
                          Math.floor(Math.random() * 255),
                          Math.floor(Math.random() * 255)]

                // bar dataset for new user
                var newTargetBar = {
                        label: key,
                        stack: key,
                        data: [],
                        backgroundColor: [
                            'rgba('+rc[0].toString()+', '+rc[1].toString()+', '+rc[2].toString()+', 0.2)',
                            'rgba('+rc[0].toString()+', '+rc[1].toString()+', '+rc[2].toString()+', 0.2)',
                            'rgba('+rc[0].toString()+', '+rc[1].toString()+', '+rc[2].toString()+', 0.2)',
                            'rgba('+rc[0].toString()+', '+rc[1].toString()+', '+rc[2].toString()+', 0.2)',
                            'rgba('+rc[0].toString()+', '+rc[1].toString()+', '+rc[2].toString()+', 0.2)',
                            'rgba('+rc[0].toString()+', '+rc[1].toString()+', '+rc[2].toString()+', 0.2)',
                            'rgba('+rc[0].toString()+', '+rc[1].toString()+', '+rc[2].toString()+', 0.2)'
                        ],
                        borderColor: [
                            'rgba('+rc[0].toString()+', '+rc[1].toString()+', '+rc[2].toString()+', 1)',
                            'rgba('+rc[0].toString()+', '+rc[1].toString()+', '+rc[2].toString()+', 1)',
                            'rgba('+rc[0].toString()+', '+rc[1].toString()+', '+rc[2].toString()+', 1)',
                            'rgba('+rc[0].toString()+', '+rc[1].toString()+', '+rc[2].toString()+', 1)',
                            'rgba('+rc[0].toString()+', '+rc[1].toString()+', '+rc[2].toString()+', 1)',
                            'rgba('+rc[0].toString()+', '+rc[1].toString()+', '+rc[2].toString()+', 1)',
                            'rgba('+rc[0].toString()+', '+rc[1].toString()+', '+rc[2].toString()+', 1)'
                        ],
                        borderWidth: 1
                };
                myBarChart.data.datasets.push(newTargetBar);
                //myBarChart.data.datasets.push(newTargetBar);
                var newTargetLine = {
        			         label: key,
                             stack: key,
        			         backgroundColor: newTargetBar.backgroundColor[0],
        			         borderColor: newTargetBar.borderColor[0],
        			         data: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        		             fill: false,
        		    };
                myLineChart.data.datasets.push(newTargetLine);
                var newTargetPie = {
        			    data: [],
        			    backgroundColor: newTargetBar.borderColor[0],
        			    label: key
        		    };
                myPieChart.data.datasets.push(newTargetPie);
                // prepare data for box chart
                for (var hash in total[key]["days"]) {
                    if (!totalDays[key][hash]) {
                        totalDays[key][hash] = total[key]["days"][hash]
                    } else {
                        totalDays[key][hash] += total[key]["days"][hash]
                    }
                }
                // load data for box chart
                for (var hash in totalDays[key]) {
                    myBarChart.data.datasets[0].data.push(totalDays[key][hash]);
                }
                // prepare data for line chart
                for (var hash in total[key]["hours"]) {
                    if (!totalHours[hash]) {
                        totalHours[key][hash] = total[key]["hours"][hash]
                    } else {
                        totalHours[key][hash] += total[key]["hours"][hash]
                    }
                }
                // load data in line chart
                for (var hash in totalHours[key]) {
                    myLineChart.data.datasets[0].data[parseInt(hash)] = totalHours[key][hash];
                }
                myPieChart.data.labels.push(key);
                myPieChart.data.datasets[0].data.push(total[key]["value"]);
                myPieChart.data.datasets[0].backgroundColor.push(myBarChart.data.datasets[0]["borderColor"][0]);
            }
            //for (let u = 0; u < heapUsers.toArray().length; u++) {
            //    myPieChart.data.labels.push(heapUsers.toArray()[u]["users"]["name"]);
            //    myPieChart.data.datasets[0].data.push(heapUsers.toArray()[u]["users"]["value"]);
            //    myPieChart.data.datasets[0].backgroundColor.push(myBarChart.data.datasets[0]["borderColor"][0]);
            //}
            //for (var key in total) {
            //    for (var hash in total[key]["days"]) {
            //        if (!totalDays[hash]) {
            //            totalDays[hash] = total[key]["days"][hash]
            //        } else {
            //            totalDays[hash] += total[key]["days"][hash]
            //        }
            //    }
            //}
            //for (var key in totalDays) {
            //    myBarChart.data.datasets[0].data[parseInt(key) - 1] = totalDays[key];
            //}
            myBarChart.update();
            myRadarChart.update();
            // for line chart

            //for (var key in total) {
            //    for (var hash in total[key]["hours"]) {
            //        if (!totalHours[hash]) {
            //            totalHours[hash] = total[key]["hours"][hash]
            //        } else {
            //            totalHours[hash] += total[key]["hours"][hash]
            //        }
            //    }
            //}
            //for (var key in totalHours) {
            //    myLineChart.data.datasets[0].data[parseInt(key)] = totalHours[key];
            //}
            myLineChart.update();
            // for doughnut chart
            //myPieChart.data.labels.pop();
            //myPieChart.data.datasets[0].data.pop();
            //for (let i = 0; i < heapUsers.toArray().length; i++) {
            //    myPieChart.data.labels.push(heapUsers.toArray()[i]["users"]["name"]);
            //    myPieChart.data.datasets[0].data.push(heapUsers.toArray()[i]["users"]["value"]);
            //}
            myPieChart.update();
        } else {
            var newDataset = upgradeCharts(totalDatasets, total);
            cleanPieChart(myPieChart.data);
            //cleanRadarChart(myRadarChart.data);
            myRadarChart.data.labels = [];
            myRadarChart.data.datasets[0].data = [];
            myPieChart.data.labels = [];
            myPieChart.data.datasets[0].data = [];
            heapUsers = newDataset['heapUsers'];
            heapHashtags = newDataset['heapHashtags'];
            myBarChart.data = newDataset['barChartData'];
            myLineChart.data = newDataset['lineChartData'];
            for (let i = 0; i < heapUsers.toArray().length; i++) {
                myPieChart.data.labels.push(heapUsers.toArray()[i]["users"]["name"]);
                myPieChart.data.datasets[0].data.push(heapUsers.toArray()[i]["users"]["value"]);
                myPieChart.data.datasets[0].backgroundColor.push(myLineChart.data.datasets[i].borderColor);
            }
            for (let i = 0; i < heapHashtags.toArray().length; i++) {
                myRadarChart.data.labels.push(heapHashtags.toArray()[i]["hashtags"]["name"]);
                myRadarChart.data.datasets[0].data.push(heapHashtags.toArray()[i]["hashtags"]["value"]);
            }
            myPieChart.update();
            myBarChart.update();
            myLineChart.update();
            myRadarChart.update();
        }
        totalDatasets['globalData'] = total;
        totalDatasets['myPieChart'] = myPieChart.data;
        totalDatasets['myLineChart'] = myLineChart.data;
        totalDatasets['myBarChart'] = myBarChart.data;
        totalDatasets['myRadarChart'] = myRadarChart.data;
        totalDatasets['geo_points'] = addGeoPoints(total, totalDatasets["geo_points"]);
        totalDatasets['tweets'] = addTweetsCloud(total, totalDatasets["tweets"]);
        total = {};
    });
    return totalDatasets
};

function addGeoPoints(hashTable, points) {
    for (var key in hashTable) {
        var _ob = {"user": key, "geo_points": hashTable[key]["geo_points"]};
        points.push(_ob);
    }
    return points
}

function addTweetsCloud(hashTable, points) {
    for (var key in hashTable) {
        var _ob = hashTable[key]["tweets"];
        points.push(_ob);
    }
    return points
}

function cleanPieChart(chartData) {
    // clean previous results
    for (let i = 0; i < chartData.labels.length; i++) {
        chartData.labels.pop();
        chartData.datasets[0].data.pop();
    }
    chartData.datasets[0].backgroundColor = [];
};
function cleanRadarChart(chartData) {
    // clean previous results
    for (let i = 0; i < chartData.labels.length; i++) {
        chartData.labels.pop();
    }
    for (let i = 0; i < chartData.datasets[0].data.length; i++) {
        chartData.datasets[0].data.pop();
    }
};

function iterateOverTotalForHeaps(total, heapUsers, heapHashtags) {
    var _tempDict = {};
    for (var key in total) {
        heapUsers.push({"users":
            {"value": total[key]["value"], "name": key}});
        for (var hash in total[key]["hashtags"]) {
            if (!_tempDict[hash]) {
                _tempDict[hash] = total[key]["hashtags"][hash]
            } else {
                _tempDict[hash] += total[key]["hashtags"][hash]
            }
        }
    }
    for (var hash in _tempDict) {
        heapHashtags.push({"hashtags":
        {"value": _tempDict[hash], "name": hash}});
    };
    return heapUsers, heapHashtags
}

function upgradeCharts(totalDatasets, total) {
    /* upgrade Pie chart:
    Pie chart stores Top5 Users, so need to recalculate;
    I also iterate for hashtags, you know, performance
    */

    var old_heapHashtags = new Heap(function(a, b) {
        return a.hashtags.value - b.hashtags.value;
    });
    var heapHashtags = new Heap(function(a, b) {
        return a.hashtags.value - b.hashtags.value;
    });
    var heapUsers = new Heap(function(a, b) {
        return a.value - b.value;
    });

    // add new data
    heapUsers, old_heapHashtags = iterateOverTotalForHeaps(total, heapUsers, old_heapHashtags);
    // now add old data
    for (let u=0; u < totalDatasets['myPieChart'].datasets[0].data.length; u++) {
        heapUsers.push({"users":
            {
                "value": totalDatasets['myPieChart'].datasets[0].data[u],
                "name": totalDatasets['myPieChart'].labels[u]
            }
        })
    }

    var old_heapHashtagsArray = old_heapHashtags.toArray();
    var old_heapHashtagsTable = {};
    for (let i = 0; i < old_heapHashtagsArray.length; i++) {
        old_heapHashtagsTable[old_heapHashtagsArray[i]["hashtags"]["name"]] = old_heapHashtagsArray[i]["hashtags"]["value"];
    }
    for (let u=0; u < totalDatasets['myRadarChart'].datasets[0].data.length; u++) {
        var value = 0;
        if (old_heapHashtagsTable[totalDatasets['myRadarChart'].labels[u]]) {
            value = old_heapHashtagsTable[totalDatasets['myRadarChart'].labels[u]] + totalDatasets['myRadarChart'].datasets[0].data[u];
            heapHashtags.push({"hashtags":
                {
                    "value": value,
                    "name": totalDatasets['myRadarChart'].labels[u]
                }
            });
             delete old_heapHashtagsTable[totalDatasets['myRadarChart'].labels[u]];
        } else {
            value = totalDatasets['myRadarChart'].datasets[0].data[u];
            heapHashtags.push({"hashtags":
                {
                    "value": value,
                    "name": totalDatasets['myRadarChart'].labels[u]
                }
            });
        }
    }
    // add old hashtags
    for (var key in old_heapHashtagsTable) {
        heapHashtags.push({"hashtags": {
            "value": old_heapHashtagsTable[key],
            "name": key
        }})
    }
    // select tops
    while ( 15 < heapHashtags.size() ){
        heapHashtags.pop();
    }
    while ( 15 < heapUsers.size() ) {
        heapUsers.pop();
    }
    // update line chart
    lineChartData = totalDatasets['myLineChart'];
    var u = lineChartData.datasets.length;
    for (var key in total) {
        var rc = [Math.floor(Math.random() * 255),
                  Math.floor(Math.random() * 255),
                  Math.floor(Math.random() * 255)]
        var newTarget = {};
        var newData = [];
        for (let i = 0; i < 24; i++) {
            if (!total[key]["hours"][i.toString()]) {
                newData.push(0);
            }
            else {
                newData.push(total[key]["hours"][i.toString()]);
            }
        }
        //for (var hash in total[key]["hours"]) {
        //   (newData.push(total[key]["hours"][hash]);
        //}
        newTarget = {
            "data": newData,
            "label": key,
            "backgroundColor": 'rgba('+rc[0].toString()+', '+rc[1].toString()+', '+rc[2].toString()+', 1)',
            "borderColor": 'rgba('+rc[0].toString()+', '+rc[1].toString()+', '+rc[2].toString()+', 1)',
            "fill": false
        }
        lineChartData.datasets.push(newTarget);
    }
    // update bar chart
    barChartData = totalDatasets['myBarChart'];
    for (var key in total) {
        var i = 1;
        var _data = [];
        for (var hash in total[key]["days"]) {
            _data.push(total[key]["days"][hash]);
        }
        newTargetBar = {
            "data": _data,
            "label": key,
            "stack": key,
            "backgroundColor": newTarget.backgroundColor,
            "borderColor": newTarget.borderColor,
            "borderWidth": 1
        }
        barChartData.datasets.push(newTargetBar);
    }
    var newDataset = {
        "heapUsers": heapUsers,
        "heapHashtags": heapHashtags,
        "barChartData": barChartData,
        "lineChartData": lineChartData
    }
    return newDataset
}
