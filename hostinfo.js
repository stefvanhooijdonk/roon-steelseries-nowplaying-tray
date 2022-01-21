// to reuse later, and keep our adapters as stupid as possible
class HostInfo {

    constructor(app){
        
        const os = require( 'os');

        this.hostname = os.hostname();
        this.isMacOSX = os.platform() == "darwin";
        this.isWindows = os.platform() == "win32";
        this.userDataPath = app.getPath('userData');
        //this.applicationLogsPath = app.getPath('logs');

        // only on windows is this value relevant or available
        if(this.isWindows){
            const process = require( 'process');
            
            this.windowsAllUserProfilesPath = process.env.ALLUSERSPROFILE;
        }
    }
}

module.exports = HostInfo;