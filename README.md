## Roon Now Playing as an Tray Application

## Introduction
Experiment to have a Roon zone publish now playing song info to my Steelseries keyboard OLED screen using a Steelseries Gamesense App.
Special thanks to __docBliny__ and his work on the Roon / App part: https://github.com/docBliny/obs-roon-display.git


### How it looks on my Apex PRO TKL

This app is a tray application. Right click it to see your current available zones. Don't forget to Enable the Roon Extension in the Roon App the first time.

<img width="150" alt="Tray application" src="https://user-images.githubusercontent.com/17196910/150343373-57b75284-d02c-410f-a3c5-c77477843429.png">

The Extension in Roon is enabled, and will show even some status info:

<img src="https://user-images.githubusercontent.com/17196910/150343719-541dca91-0eb8-4278-9685-172b35374c8e.png" width=400/>

And the OLED will show a scrolling Song title, the artists and a progress bar:

<img src="https://user-images.githubusercontent.com/17196910/150343155-97ab09b2-1d0b-4377-aff3-527c43968fea.jpeg" width=350/>


### Using

This little _App_ relies on two SDK's.

- [Roon NodeJS API](https://github.com/RoonLabs/node-roon-api)
- [Steelseries Gamesense SDK](https://github.com/SteelSeries/gamesense-sdk)
- Electron



### Run the code

I have this working with:
- Node v17.3.1 (installed via homebrew)
- Roon v1.8 (build 884) running on ROCK
- Steelseries GG for MacOSX 12.2 
- Mac OSX Montery 12.1

Download the code in this Repo (with a git clone)
```shell
git clone git@github.com:stefvanhooijdonk/roon-steelseries-nowplaying-tray.git
```
Then run the npm install command to get all the dependencies in place:
```shell
npm install
```
And run the app from the command line:
```shell
npm start
```

If all is well, this node App should now show up in your Roon Extentions. Go and enable it there. Once that is done, and you start playing songs via Roon in your zone you should see the song title scrolling, the artists and a progress bar for the song play duration.

If you want, you can package this app and run it as a "real" app. 
```shell
npm run make
```
