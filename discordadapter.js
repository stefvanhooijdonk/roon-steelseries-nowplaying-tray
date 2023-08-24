const EventEmitter = require('events');
const DiscordRPC = require('discord-rpc');

class DiscordAdapter extends EventEmitter {

    constructor(discordClientId, discordClientSecret, discordAccessToken){
        super();
        this._discordClientId = discordClientId;
        this._discordClientSecret = discordClientSecret;
        this._discordAccessToken = discordAccessToken;
        this._discordConnected = false;
        this._reconnectionTimer = null;
        //this._rpc = null;
        this._discordClient = null;
        this._lastSentStatus = null;
        this._lastSongTitle = null;        
    }

    scheduleReconnection(discordAdapter) {
        clearTimeout(discordAdapter._reconnectionTimer);
        discordAdapter._discordConnected = false;
        discordAdapter._lastSentStatus = null;        
        
        console.log('Discord trying to connect to local app in 5 secs..');
        
        discordAdapter._reconnectionTimer = setTimeout(
            discordAdapter.connectToDiscord, 
            5 * 1000, 
            discordAdapter);
    }
    
    connectToDiscord(discordAdapter) {

        if( discordAdapter._rpc && 
            discordAdapter._rpc.transport &&
            discordAdapter._rpc.transport.socket && 
            discordAdapter._rpc.transport.socket.readyState === 1 ) {
                discordAdapter._rpc.destroy();
        }

        discordAdapter._rpc = new DiscordRPC.Client({ transport: 'ipc' });

        discordAdapter._rpc.on('ready', () => {
            console.log(`Discord local App authed for user: ${discordAdapter._rpc.user.username}`);
            discordAdapter._discordConnected = true;
            clearTimeout(discordAdapter._reconnectionTimer);
            discordAdapter.emit('discord-connected');
        });
    
        discordAdapter._rpc.transport.once('close', () => {
            console.log("Disconnected from discord...");
            discordAdapter._discordConnected = false;
            discordAdapter.emit('discord-disconnected');
            discordAdapter.scheduleReconnection(discordAdapter);
        });
        
        // (syn): catching connection error is _not_ sufficient, exception is swallowed downstream
        try {
            // (syn): by sending `scopes`, the client constantly prompts for auth.
            // seems to work fine without it.
            
            console.log('Discord rpc login..');
            discordAdapter._rpc.login({ 
                clientId:discordAdapter._discordClientId,
                clientSecret:discordAdapter._discordClientSecret //,
                //scopes: ["rpc", "identify"],
                //redirectUri: 'http://localhost:3000/api/auth/callback/discord' 
            }).catch(console.error);

            discordAdapter._discordAccessToken = discordAdapter._rpc.accessToken;
        } 
        catch(error){
            console.log('Error in discord: ' + error);  
            discordAdapter.scheduleReconnection(discordAdapter);
        }
    }

    setActivityClosed() {
        if(!this.isConnected()) return;
        this._rpc.clearActivity();
    }

    setActivity(line1, line2, songLength, currentSeek, zoneName) {
        if(!this.isConnected()) return;

        const startTimestamp = Math.round((new Date().getTime() / 1000) - currentSeek);
        const endTimestamp = Math.round(startTimestamp + songLength);
        let songtitle = line1.substring(0, 128);

        // rate limit a bit...
        if(Date.now() - this._lastSentStatus < 1000 * 10 && songtitle == this._lastSongTitle) {
            return;
        } else {
            this._lastSentStatus = Date.now();
            this._lastSongTitle = songtitle;
        }

        this._rpc.setActivity({ 
            details: songtitle,
            state: line2.substring(0, 128),
            startTimestamp,
            endTimestamp,
            largeImageKey: 'roon-main',
            largeImageText: `Zone: ${zoneName}`,
            smallImageKey: 'play-symbol',
            smallImageText: `Roon: ${zoneName}`,
            instance: false
        });
    }

    setActivityLoading(zoneName) {
        if(!this.isConnected()) return;
        
        this._rpc.setActivity({
            details: 'Loading...',
            largeImageKey: 'roon-main',
            largeImageText: `Zone: ${zoneName}`,
            smallImageKey: 'roon-small',
            smallImageText: 'Roon',
            instance: false
        });
    }

    setActivityPaused(line1, line2, zoneName) {
        if(!this.isConnected()) return;        
        this._rpc.clearActivity();
    }

    setActivityStopped() {
        if(!this.isConnected()) return;
        this._rpc.clearActivity();
    }

    start(){
        console.log("Discord connecting to local app");
        DiscordRPC.register(this._discordClientId);
        this.connectToDiscord(this);
    }
    
    stop(){
        console.log("Discord disconnecting to local app");
        if(!this.isConnected()) return;
        this._rpc.clearActivity();
    }

    isConnected() {
        return this._rpc && this._discordConnected;
    }
}

module.exports = DiscordAdapter