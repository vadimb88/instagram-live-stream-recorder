# Live stream recorder for Instagram
This command line program records ongoing live stream and save it into .mp4 video file.

## Installation
This program uses ffmpeg for postprocessing video. You need to install it using [official site](https://ffmpeg.org/download.html) 
You need to add it to `PATH` or set `FFMPEG_PATH` and `FFPROBE_PATH` environment variables as it described [here](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg/blob/master/README.md#ffmpeg-and-ffprobe)

Next you need to clone this repositiry and install dependencies
```
git clone https://github.com/vadimb88/instagram-live-stream-recorder.git
cd instagram-live-stream-recorder
npm install
```

## Running
You need to copy `template.config.default.json` to `config.default.json` and add your csrfToken and sessionId to it. Program loads `config.default.json` by default if it exists and if user hasn't provided another config using `--config` paramenter.

Now you can run the programm:
```
node record.js -u your_friends_username --full --verbose
```
or
```
node record.js -i your_friends_user_id --full --verbose
```

## Command line arguments
Instead of using config file you can use command line arguments. `config.default.json` will be loaded anyway, but command line arguments will override arguments from config file.
```
  -u                    Target username
  -i                    Target userId
  -m                    Target streams mpd file url
  -o                    Output file name
  -c                    CsrfToken
  -s                    SessionId
  -p                    Proxy string
  --config              File path to custom config file.
                        Will override default config file
  --get-full            Try to download full stream. Script will 
                        try to fetch parts of the stream which played
                        before script's been started
  --leave-temp          Don't delete temp files
  --verbose             Verbose mode
  --help                List of possible arguments
```
## Examples
```
node record.js -u your_friends_user_id -c "your csrfToken" -s "your sessionId" -p "socks://192.168.0.20:8128" --getfull --verbose
```

or
```
node record.js -m "https://url.to.mpd.file/1234.mpd" --config "custom-config.json"
```

## License

MIT