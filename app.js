const {app, BrowserWindow, ipcMain} = require('electron');

const url = require('url');
const path = require('path');

let mainWindow;

app.on('ready' , function(){
  win = new BrowserWindow({
    width: 1300,
    height: 745,
    minWidth: 200,
    minHeight: 200,
    autoHideMenuBar: true,
    show: false,
    icon: __dirname + '/logo/twint.png'
  });
  win.on('close', () => {
    win = null;
  });
  win.loadURL(url.format({
    pathname: path.join(__dirname, 'pages/charts000.html'),
    protocol: 'file:',
    slashes: true
  }));
  win.once('ready-to-show', () => {
    win.show();
  });
  win.on('close', () => app.quit());
});
