const fs = require( 'fs');
const axios =require( "axios");

class SteelseriesAdapter {

  // ********************************************
  // * Constructors
  // ********************************************
  constructor(author, hostinfo) {

    // read file from correct location based on operating system
    this._gameSenseAddressFile = '/Library/Application Support/SteelSeries Engine 3/coreProps.json';
    if (hostinfo.isWindows) {
      this._gameSenseAddressFile = 
        hostinfo.windowsAllUserProfilesPath + '\\SteelSeries\\SteelSeries Engine 3\\coreProps.json';
    }

    this._steelseriesGameID = "SVHROON";
    this._steelseriesGameEventID = "NOWPLAYING";
    this._author = author;
    this._textIndex = 0;
    
    // gamesense progress bars are always 0-100 based.
    this._progressBarResolution = 100;
  }

  isConnected(){
    return this._heartBeatTimer != null;
  }

  start(){
    this._gameSenseUrl = this.findSteelSeriesEngineAddress();
    console.info("Steelseries gamesense found at: "+ this._gameSenseUrl);

    this.registerSteelseriesGameAndEvent();

    this._heartBeatTimer = setInterval(this.sendHeartBeat,9750,this);
    console.info("Steelseries gamesense heartbeat started to "+ this._gameSenseUrl);
    this._textIndex = 0;
  }

  stop(){
      if(this._heartBeatTimer) {
        clearTimeout(this._heartBeatTimer);
        this._heartBeatTimer = null
      }
      this.removeGameFromSteelseries();
      this._textIndex = 0;
  }

  sendSimpleStatus(ctx, line1, line2){
    this._textIndex = 0;

    let displayevent = {
      game: ctx._steelseriesGameID,
      event: ctx._steelseriesGameEventID,
      data: {
        frame:{
          "artists": line2,
          "songtitle": line1          
        }        
      }
    };

    ctx.sendNowPlayingUpdateToSteelseries(ctx, displayevent);
  }

  newSongStarted(){
    this._textIndex = 0;
  }

  sendScrollTextToDisplay(zoneName, seekPosition, songLength, songTitle, songArtists, songAlbum){        

    // calcuate progress 0<100;
    let progressBar = Math.floor(seekPosition / songLength * this._progressBarResolution);

    // scroll song title if too long.
    let scrollingText = songTitle;

    // about 16 chars fit on zone one of Steelseries OLEDS
    if(scrollingText.length > 16){
        scrollingText = songTitle.substring( this._textIndex) + " | ";
        if(this._textIndex > 0) {
            scrollingText += songTitle.substring( 0, this._textIndex);
        }        
        this._textIndex ++;
        if(this._textIndex > songTitle.length){
            this._textIndex = 0;
        }
    }

    let nowplayingevent = {
    game: this._steelseriesGameID,
    event: this._steelseriesGameEventID,
    data: {
        value: progressBar,
        frame:{
            "artists": songArtists,
            "songtitle": scrollingText,
            "album": songAlbum
        }        
    }
    };

    // first few seconds (currentZone.now_playing.seek_position) we shop Now playing
    if(seekPosition < 4) {
        nowplayingevent.data.frame.songtitle = zoneName + " now playing:";
        nowplayingevent.data.frame.artists = songTitle;
    }

    this.sendNowPlayingUpdateToSteelseries(this, nowplayingevent);
  }
  
  sendHeartBeat(thiscontext){
    const heartbeatEvent = {
        game: thiscontext._steelseriesGameID
      };    
  
      axios
        .post(
            thiscontext.getSteelseriesAPIUrl(thiscontext,"game_heartbeat"),
            heartbeatEvent)
        .then(res => {
        })
        .catch(error => {
        });
  }

  findSteelSeriesEngineAddress(){
    let rawdata = fs.readFileSync(this._gameSenseAddressFile);
    let coreProps = JSON.parse(rawdata);

    rawdata = null;
    return coreProps.address;
  }

  registerSteelseriesGameAndEvent(){
    const roongame = {
      game: this._steelseriesGameID,
      game_display_name: "Roon Display Song",      
      developer: this._author
    };    

    axios
      .post(this.getSteelseriesAPIUrl(this,"game_metadata"),roongame)
      .then(res => {
        console.log(`Registered Game in Steelseries Engine: statusCode: ${res.status}`);
      })
      .catch(error => {
        this.logError(error);
      });

    const roonnowplaying = {
      game: this._steelseriesGameID,
      event: this._steelseriesGameEventID,
      "icon_id": 23,
      "value_optional": true,
      handlers: [{
          "device-type": "screened",
          mode: "screen",
          zone: "one",
          datas: [
            {
              lines: [
                      { "has-text": true, "context-frame-key": "songtitle"},
                      { "has-text": true, "context-frame-key": "artists"},
                      { "has-progress-bar": true }
                  ]
            }
          ]}
        ]};      
   
    axios
      .post(this.getSteelseriesAPIUrl(this,"bind_game_event"),roonnowplaying)
      .then(res => {
        console.info(`Registered Now Playing in Steelseries Engine: statusCode: ${res.status}`)
      })
      .catch(error => {
        this.logError(error);
      });
  }

  removeGameFromSteelseries(){
      // remove all.
    axios
      .post(this.getSteelseriesAPIUrl(this,"remove_game"),{game: this._steelseriesGameID})
      .then(res => {
        console.info(`Remove Game in Steelseries Engine: statusCode: ${res.status}`);
      })
      .catch(error => {
        this.logError(error);
      });

  }

  sendNowPlayingUpdateToSteelseries(ctx, nowplayingevent){
    // send event to GameSense GG server
    axios
      .post(ctx.getSteelseriesAPIUrl(ctx,"game_event"), nowplayingevent)
      .then(res => {
        //console.log(`Sent event to Steelseries Engine: statusCode: ${res.status}`)
      })
      .catch(error => {
        ctx.logError(error);
        this.stop();
      });    
  }

  getSteelseriesAPIUrl(ctx, apiendpoint){
    return  'http://' + ctx._gameSenseUrl + "/" + apiendpoint;
  }

  logError(error){
    console.error(error.code + " " + error.config.url);
  }
}

module.exports = SteelseriesAdapter