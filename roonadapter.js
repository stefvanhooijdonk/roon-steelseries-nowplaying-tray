const EventEmitter = require('events');
const RoonApi = require( "node-roon-api");
const RoonApiStatus = require( "node-roon-api-status");
const RoonApiImage = require( "node-roon-api-image");
const RoonApiTransport = require( "node-roon-api-transport");
const slug = require( "slug");
const fs = require( 'fs');

class RoonAdapter extends EventEmitter{
    
  // ********************************************
  // * Constructors
  // ********************************************
  constructor(roonPairingTokenFile, author, hostinfo) {  
    super();  
    this._zones = {};
    this._author = author;
    this._hostname = hostinfo.hostname;
    this._connected = false;

    this._roon = new RoonApi({
      extension_id:        "svh-roon-steelseries",
      display_name:        "Simple Now Playing display intended for Steelseries Oleds",
      display_version:     "1.0.0",
      publisher:           author,
      email:               "stef@personaloffice365.com",
      website:             "https://twitter.com/vanHooijdonk",
      log_level:           "none",

      core_paired: this.corePaired.bind(this),
      core_unpaired: this.coreUnpaired.bind(this),
    });

    // overriding the default safe, to use the users apps settings fodler
    this.roon.save_config = function(k, v) {
      try {
          let config;
          try {
              let content = fs.readFileSync(
                roonPairingTokenFile, 
                { encoding: 'utf8' });
              config = JSON.parse(content) || {};
          } catch (e) {
              config = {};
          } 
          if (v === undefined || v === null)
              delete(config[k]);
          else
              config[k] = v;
          fs.writeFileSync(
            roonPairingTokenFile, 
            JSON.stringify(config, null, '    '));
      } catch (e) { }
    };
    
    // overriding the default safe, to use the users apps settings fodler
    this.roon.load_config = function(k) {
      try {
          let content = fs.readFileSync(
            roonPairingTokenFile, 
            { encoding: 'utf8' });
          return JSON.parse(content)[k];
      } catch (e) {
          return undefined;
      }
    };
  }

  // ********************************************
  // * Properties
  // ********************************************
  
  get roon() {
    return this._roon;
  }

  get roonCore() {
    return this._roonCore;
  }

  get zones() {
    // Everyone gets their own copy
    return Object.assign({}, this._zones);
  }

  isConnected() {
    return this._connected;
  }

  // ********************************************
  // * Public methods
  // ********************************************
  start() {
      // Start Roon
      this.roonApiStatus = new RoonApiStatus(this.roon);

      this.roon.init_services({
        required_services: [ RoonApiTransport, RoonApiImage ],
        provided_services: [ this.roonApiStatus ]
      });

      this.roonApiStatus.set_status("Extension enabled on " + this._hostname, false);

      this.roon.start_discovery();
      console.info("Roon Extention started discovery.");
  }

  stop(){
    this.roonApiStatus = null;
    console.info("Roon Extention stopped.");
  }

  // ********************************************
  // * Private methods
  // ********************************************
  corePaired(core) {
    this._roonCore = core;
    
    console.info("Roon Extention paired with Core.");

    const transport = core.services.RoonApiTransport;
    transport.subscribe_zones((response, data) => {
      switch(response) {
      case "Subscribed":
        this.setZonesFromData(data.zones);
        break;
      case "Changed":
        if(data.zones_changed) {
          this.setZonesFromData(data.zones_changed);
        }

        if(data.zones_seek_changed) {
          this.updateZonesFromSeekData(data.zones_seek_changed);
        }
        break;
      default:
        // this.logger.warn(`Unhandled subscription response "${response}"`);
        break;
      }
    });
    this._connected = true;
    this.emit('core-paired');
  }

  coreUnpaired(core) {
    // core.moo.transport.logger.log("Roon core unpaired");    
    this._nowPlaying = null;
    this._connected = false;
    this.emit('core-unpaired');
    console.info("Roon Extention was un-paired with Core.");
  }

  /**
   * Sets the zones from Roon data. Creates a unique slugified zone name for each zone.
   * Duplicate display names will get an index appended to the zone name.
   *
   * @param      {Object}  zoneData    The Roon zone data.
   */
  setZonesFromData(zoneData) {
    const zoneNames = [];

    if(Array.isArray(zoneData)) {
      // Loop all zones and create unique internal entries
      zoneData.forEach((zone) => {
        let zoneName = slug(zone.display_name);

        if(Object.prototype.hasOwnProperty.call(zoneNames, zoneName)) {
          zoneNames[zoneName] += 1;
          zoneName = `${zoneName}_${zoneNames[zoneName]}`;
        } else {
          zoneNames[zoneName] = 1;
        }
        zone._zoneName = zoneName;

        // Track by native zone ID. This will keep our unique names consistent while we're running
        this._zones[zone.zone_id] = zone;

        // log current zone status
        if(zone.now_playing && zone.now_playing.two_line){
            this.emit('zone-playing', 
              zone._zoneName, 
              zone.state, 
              zone.now_playing.two_line.line1,
              zone.now_playing.two_line.line2);
        }
        else{
            this.emit('zone-playing', zone._zoneName, zone.state, null);
        }
      });

      this.emit('zones-updated', this.zones);
    }
  }
  
  sendRoonStatus(zoneName){
    this.roonApiStatus.set_status(
      "On " + this._hostname + " showing zone " + zoneName + " on Steelseries keyboard", false);
  }

  updateZonesFromSeekData(zoneData) {
    // log("seek zone", zone, data.zones_seek_changed);
    if(Array.isArray(zoneData)) {
      zoneData.forEach((seekZone) => {
        const zone = this.zones[seekZone.zone_id];

        if(zone && zone.now_playing) {
          zone.now_playing.seek_position = seekZone.seek_position;
          // only publish to Steelseries if we want this zone to show.
          this.emit('zone-playing-seekupdate', 
            zone._zoneName,   // zone name
            zone.state,       // playing
            seekZone.seek_position, // 40
            zone.now_playing.length, // 120          
            zone.now_playing.three_line.line1, // song title
            zone.now_playing.three_line.line2, // artists
            zone.now_playing.three_line.line3); // album
        }
      });
    }
  }

  /**
   * Gets the zone by the internal zone name.
   *
   * @param      {<type>}  zoneName  The zone name.
   *
   * @return     {<type>}  The zone by zone name, or null if not found.
   */
  getZoneByZoneName(zoneName) {
    let result = null;

    for(const zoneId of Object.keys(this.zones)) {
      const zone = this.zones[zoneId];
      if(zone._zoneName === zoneName) {
        result = zone;
        break;
      }
    }

    return result;
  }  
}

module.exports = RoonAdapter
