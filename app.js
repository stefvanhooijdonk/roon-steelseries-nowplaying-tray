const HostInfo = require('./hostinfo.js');

const { app, nativeImage, Tray, Menu } = require('electron'); // http://electron.atom.io/docs/api
const hostinfo = new HostInfo(app);

if (hostinfo.isMacOSX) {
  app.dock.hide();
}
const path = require('path');
const fs = require( 'fs');

const RoonAdapter = require('./roonadapter.js');
const SteelseriesAdapter = require('./steelseriesadapter.js');

const statePlaying = 'playing';

let roonAdapter = null;
let steelSeriesAdapter= null;

let playIconFileName = path.join(__dirname, '/assets/electron-play.png');
let stopIconFileName = path.join(__dirname, '/assets/electron-stopped.png');
let pauseIconFileName = path.join(__dirname, '/assets/electron-pause.png');

let appSettingsFileName = path.join(hostinfo.userDataPath, "appsettings.json");
let roonPairingTokenFileName = path.join(hostinfo.userDataPath, "roon-core-config.json");

let tray = null
let settings = {currentZone: null};

// Wait until the app is ready
app.whenReady().then(() => {
 
  loadSettings();

  var iconPath = path.join(__dirname, '/assets/electron-icon.png') // your png tray icon
  let trayIcon = nativeImage.createFromPath(iconPath);
 
  tray = new Tray(trayIcon);
  tray.on('double-click', quitApp);
  tray.on('before-quit', saveSettings);

  tray.setToolTip("Enable the Roon Extension...");

  var author = "Stef van Hooijdonk";

  roonAdapter = new RoonAdapter(roonPairingTokenFileName, author, hostinfo);

  roonAdapter.on('core-paired',roonCoreIsPaired);
  roonAdapter.on('core-unpaired',roonCoreIsUnPaired);
  roonAdapter.on('zones-updated',createTrayContextMenuFromZones);
  roonAdapter.on('zone-playing',zoneIsPlayingSong);
  roonAdapter.on('zone-playing-seekupdate',zoneIsPlayingSongSeekUpdate);
  roonAdapter.start();

  steelSeriesAdapter = new SteelseriesAdapter(author,hostinfo);
  steelSeriesAdapter.start();
  steelSeriesAdapter.sendSimpleStatus(steelSeriesAdapter,"Loading ...","");

  createTrayContextMenuFromZones(null);
});

function quitApp(){
  if(steelSeriesAdapter){
    steelSeriesAdapter.stop();
  }
  if(settings){
    saveSettings();
  }
  app.quit();
}

function loadSettings(){
  try {
    let content = fs.readFileSync(
      appSettingsFileName, 
      { encoding: 'utf8' });
      settings = JSON.parse(content) || {};
  } catch (e) {
    console.error(e);
  } 
}

function saveSettings(){
  try {
    fs.writeFileSync(
      appSettingsFileName, 
      JSON.stringify(settings, null, '    '));
    } catch (e) {
      console.error(e);
    } 
}

function roonCoreIsPaired(){
  tray.setToolTip("Connected to Roon, you can start playing...");
  createTrayContextMenuFromZones(null);
}

function roonCoreIsUnPaired(){
  tray.setToolTip("Not connected to Roon");
  createTrayContextMenuFromZones(null);
}

function zoneIsPlayingSong(zone, state, songTitle, songArtists) {
  if(zone == settings.currentZone) {
    roonAdapter.sendRoonStatus(zone);
    if(state == statePlaying){
      setTooltipToCurrentSongAndArtist(zone, state, songTitle, songArtists);
    }
  }
  createTrayContextMenuFromZones();
}

function zoneIsPlayingSongSeekUpdate(zone, state, seekPosition, songLength, songTitle, songArtists, songAlbum){
  if(steelSeriesAdapter && zone == settings.currentZone && state == statePlaying) {
    steelSeriesAdapter.sendScrollTextToDisplay(
        zone,
        seekPosition, 
        songLength, 
        songTitle, 
        songArtists, 
        songAlbum);
  }
  setTooltipToCurrentSongAndArtist(zone, state, songTitle, songArtists);
}

function setTooltipToCurrentSongAndArtist(zone, state, songTitle, songArtists){
  if(tray && zone == settings.currentZone && state == statePlaying) {
    tray.setToolTip(zone + " is playing '" + songTitle + "' by " + songArtists);
  }
}

function trayContextMenuSelectedZone(menuItem, browserWindow, event){
  settings.currentZone = menuItem.label;
  tray.setToolTip("New zone selected: " + settings.currentZone);
  if(roonAdapter) { roonAdapter.sendRoonStatus(settings.currentZone); }
  if(steelSeriesAdapter) { steelSeriesAdapter.newSongStarted(); }
  console.info("New zone selected: " + settings.currentZone);
}

function createTrayMenuItem(zoneName, zoneState){

  let icon = null;
  let checkedState = (zoneName == settings.currentZone);
  icon = stopIconFileName;
  if(zoneState == statePlaying){
    icon = playIconFileName;
  }
  if(zoneState == "paused"){
    icon = pauseIconFileName;
  }

  if(icon){
    return  { label: zoneName , 
      type: 'radio' , 
      icon: nativeImage.createFromPath(icon),
      checked: checkedState,
      click: trayContextMenuSelectedZone};
  }
}

function createTrayContextMenuFromZones(zones){
  var contextMenuItems = new Array();
  if(zones){
    for(const zoneId of Object.keys(zones)) {
      const zone = zones[zoneId];
      contextMenuItems.push(createTrayMenuItem(zone._zoneName, zone.state));
    };
  }
  contextMenuItems.push({ type: 'separator'});

  contextMenuItems.push(
    { label: "Roon",
      type:"checkbox",
      enabled: false,
      checked: roonAdapter.isConnected()}); 

  contextMenuItems.push(
    { label: "Gamesense",
      type:"checkbox",
      enabled: false,
      checked: steelSeriesAdapter.isConnected()}); 
          
  contextMenuItems.push({ type: 'separator'});
  
  contextMenuItems.push(
        { label: "Quit", 
          click: function (event) {
            quitApp();
          }});
          
  tray.setContextMenu(Menu.buildFromTemplate(contextMenuItems));
}
