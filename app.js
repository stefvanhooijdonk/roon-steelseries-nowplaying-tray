const HostInfo = require('./hostinfo.js');

const { app, nativeImage, Tray, Menu, powerMonitor } = require('electron'); // http://electron.atom.io/docs/api
const hostinfo = new HostInfo(app);

if (hostinfo.isMacOSX) {
  app.dock.hide();
}

const path = require('path');
const fs = require( 'fs');

const RoonAdapter = require('./roonadapter.js');
const SteelseriesAdapter = require('./steelseriesadapter.js');
const DiscordAdapter = require('./discordadapter.js');

const version = app.getVersion();

require('update-electron-app')({
  logger: require('electron-log')
});

const statePlaying = 'playing';
const statePaused = 'paused';

let roonAdapter = null;
let steelSeriesAdapter= null;
let discordAdapter = null;

let playIconFileName = path.join(__dirname, '/assets/electron-play.png');
let stopIconFileName = path.join(__dirname, '/assets/electron-stopped.png');
let pauseIconFileName = path.join(__dirname, '/assets/electron-pause.png');

let appSettingsFileName = path.join(hostinfo.userDataPath, "appsettings.json");
let roonPairingTokenFileName = path.join(hostinfo.userDataPath, "roon-core-config.json");

let currentZones = null;

let tray = null
let settings = {currentZone: null, discordClientId:'1092727170369081354', discordClientSecret: null, discordAuthToken:null};

// Wait until the app is ready
app.whenReady().then(() => {
 
  loadSettings();

  let iconPath = path.join(__dirname, '/assets/electron-icon.png') // your png tray icon
  let trayIcon = nativeImage.createFromPath(iconPath);
 
  tray = new Tray(trayIcon);
  tray.on('double-click', quitApp);
  tray.on('before-quit', saveSettings);

  powerMonitor.on('suspend',onSuspend);
  powerMonitor.on('resume', onResume);

  tray.setToolTip("Enable the Roon Extension...");

  let author = "Stef van Hooijdonk";

  settings.discordClientId = "-empty-";
  settings.discordClientSecret = "-empty-";
  
  roonAdapter = new RoonAdapter(roonPairingTokenFileName, author, hostinfo);

  roonAdapter.on('core-paired',roonCoreIsPaired);
  roonAdapter.on('core-unpaired',roonCoreIsUnPaired);
  roonAdapter.on('zones-updated',createTrayContextMenuFromZones);
  roonAdapter.on('zone-playing',zoneIsPlayingSong);
  roonAdapter.on('zone-playing-seekupdate',zoneIsPlayingSongSeekUpdate);
  
  steelSeriesAdapter = new SteelseriesAdapter(author, hostinfo);

  if(settings.discordClientId != '-empty-') {
    discordAdapter = new DiscordAdapter(settings.discordClientId, settings.discordAuthToken);
    discordAdapter.on('discord-connected',discordConnected);
    discordAdapter.on('discord-disconnected',discordDisconnected);
    discordAdapter.start();
  }

  steelSeriesAdapter.start();
  steelSeriesAdapter.sendSimpleStatus(steelSeriesAdapter,"Loading ...","");

  roonAdapter.start();

  createTrayContextMenuFromZones(currentZones);
});

function initRoonAdapter(){
  if(roonAdapter){
    roonAdapter.stop();
  }

  roonAdapter.start();
  createTrayContextMenuFromZones(currentZones);
}

function initSteelseriesAdapter(){
  if(steelSeriesAdapter){
    steelSeriesAdapter.stop();
  }
  steelSeriesAdapter.start();
  createTrayContextMenuFromZones(currentZones);
}

function initDiscordAdapter(){
  if(discordAdapter){
    discordAdapter.stop();
  }
  discordAdapter.start();
  createTrayContextMenuFromZones(currentZones);
}


function onSuspend(){
  console.log("Suspending app, turing off roon and steelseries connections")
  // just to be sure
  saveSettings();

  if(steelSeriesAdapter){
    steelSeriesAdapter.stop();
  }
  if(roonAdapter){
    roonAdapter.stop();
  }
  createTrayContextMenuFromZones(currentZones);
}

function onResume(){
  console.log("Resuming app, turing on roon and steelseries connections")
  if(steelSeriesAdapter){
    steelSeriesAdapter.start();
  }
  if(roonAdapter){
    roonAdapter.start();
  }
  if(discordAdapter){
    discordAdapter.start();
  }
  createTrayContextMenuFromZones(currentZones);
}

function quitApp(){
  saveSettings();
  if(steelSeriesAdapter){
    steelSeriesAdapter.stop();
  }
  if(roonAdapter){
    roonAdapter.stop();
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
  if(settings){
    try {
      fs.writeFileSync(
        appSettingsFileName, 
        JSON.stringify(settings, null, '    '));
    } catch (e) {
      console.error(e);
    } 
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
      discordAdapter.setActivity(songTitle, songArtists, 0, 0, zone);
    }
  }
  createTrayContextMenuFromZones();
}

function discordConnected() {
  console.log("Discord connected.")
  settings.discordAuthToken = discordAdapter._discordAccessToken;  
  createTrayContextMenuFromZones(null);
}

function discordDisconnected() {
  console.log("Discord disconnected.")

  createTrayContextMenuFromZones(null);
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
    
        // line1, line2, songLength, currentSeek, zoneName
    discordAdapter.setActivity(songTitle, songArtists, songLength, seekPosition, zone);
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
  if(roonAdapter) { 
    roonAdapter.sendRoonStatus(settings.currentZone); 
  }
  if(steelSeriesAdapter) { 
    steelSeriesAdapter.newSongStarted(); 
  }
  console.info("New zone selected: " + settings.currentZone);
}

function createTrayMenuItem(zoneName, zoneState){

  let icon = null;
  let checkedState = (zoneName == settings.currentZone);
  icon = stopIconFileName;
  if(zoneState == statePlaying){
    icon = playIconFileName;
  }
  if(zoneState == statePaused){
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
  if (zones) { 
    currentZones = zones;
  }
  
  let contextMenuItems = new Array();
  if(currentZones && roonAdapter.isConnected()){
    for(const zoneId of Object.keys(currentZones)) {
      const zone = currentZones[zoneId];
      contextMenuItems.push(createTrayMenuItem(zone._zoneName, zone.state));
    };
    contextMenuItems.push({ type: 'separator'});
  }

  contextMenuItems.push(
    { label: "Roon",
      type:  "checkbox",
      enabled: !roonAdapter.isConnected(),
      click: function (event) {
        if(!roonAdapter.isConnected()){initRoonAdapter();}
      },
      checked: roonAdapter.isConnected()}); 

  contextMenuItems.push(
    { label: "Gamesense",
      type:  "checkbox",
      enabled: !steelSeriesAdapter.isConnected(),
      click: function (event) {
        if(!steelSeriesAdapter.isConnected()){initSteelseriesAdapter();}
      },
      checked: steelSeriesAdapter.isConnected()}); 
  
  if(discordAdapter){
    contextMenuItems.push(
      { label: "Discord",
        type:  "checkbox",
        enabled: !discordAdapter.isConnected(),
        click: function (event) {
          if(!discordAdapter.isConnected()){initDiscordAdapter();}
        },
        checked: discordAdapter.isConnected()}); 
  }
  contextMenuItems.push({ type: 'separator'});
  contextMenuItems.push({ label:"Version: " + version });
      
  
  contextMenuItems.push(
        { label: "Quit", 
          click: function (event) {
            quitApp();
          }});
          
  tray.setContextMenu(Menu.buildFromTemplate(contextMenuItems));
}
