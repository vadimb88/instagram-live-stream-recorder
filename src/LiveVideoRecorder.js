import { Buffer } from 'node:buffer'
import { Transform } from 'node:stream'

const delay = (timeout) => new Promise((resolve) => setTimeout(() => resolve(), timeout))

class StreamBlobs extends Transform {
  constructor (options = {}) {
    options.writableObjectMode = true    
    super(options)    
  }
  _transform (record, enc, cb) {
    record.arrayBuffer().then((arrayBuffer) => cb(null, Buffer.from(arrayBuffer)))
  }
  _flush (cb) {
    cb()
  }
}

class DurationVariants {
  constructor() {
    this.durationFrequencies = {}
    this.sum = 0
    this.count = 0
  }

  add(duration) {
    if (this.durationFrequencies[duration]) {
      this.durationFrequencies[duration]++
    } else {
      this.durationFrequencies[duration] = 1
    }
    this.sum += duration
    this.count++
  }

  getPossibleDurationsList(extended = false) {
    const mostFreq = this.getMostFrequentDuration()
    
    const durations = Object.entries(this.durationFrequencies).sort((a, b) => {
      const countDiff = b[1] - a[1]
      if (countDiff !== 0) {
        return countDiff
      }
      
      return  Math.abs(mostFreq - a[0]) - Math.abs(mostFreq - b[0])
    }).map(el => +el[0])
    
    if (!extended) {
      return durations
    }

  }
  
  getMostFrequentDuration() {
    return +Object.entries(this.durationFrequencies).reduce((max, cur) => {      
      return cur[1] > max[1] ? cur : max
    }, [0, 0])[0]
  }
}

class DetailedEvent extends Event {   // because nodejs doesn't have CustomEvent
  constructor(name, options = {}) {
    super(name, options)
    this.details = options.details
  }
}

export default class LiveVideoRecorder extends EventTarget {
  constructor(instaRequests) {
    super()
    this.requests = instaRequests
    this.durations = new DurationVariants()
    this.downloadedParts = new Set()
    this.pastVideoBlobs = []
    this.pastAudioBlobs = []
    this.pastVideoStream = new StreamBlobs()
    this.pastAudioStream = new StreamBlobs()
    this.initialised = false
    this.recording = false
    this.shouldStop = false
    this.streamIsOver = true
    this.videoSize = 0
    this.audioSize = 0
    this.pastVideoSize = 0
    this.pastAudioSize = 0
    this.videoStream = new StreamBlobs()
    this.audioStream = new StreamBlobs()
  }

  async initializeWithMpdUrl(mpdUrl) {
    if (this.initialised) {
      return {
        status: 'success',
        message: `Stream recorder initialised. Mpd url: ${this.mpdUrl}`,
      }
    }

    this.mpdUrl = mpdUrl
    const { ok: mpdRequestOk, xml: mpdXml } = await this.requests.getMpd(this.mpdUrl)
    
    if (!mpdRequestOk) {
      
      return {
        status: 'fail',
        message: 'Can\'t download mpd file',
      }
    }
    this.streamIsOver = false 
    this.startTime = mpdXml.documentElement.getAttribute('firstAvTimeMs')
    const videoSegment = mpdXml.getElementById('live-hd-v').getElementsByTagName('SegmentTemplate')[0]
    const videoInitUrl = videoSegment.getAttribute('initialization')
    const videoUrl = videoSegment.getAttribute('media')

    this.firstSegment = +videoSegment.getElementsByTagName('S')[0].getAttribute('t')
    

    const audioSegment = mpdXml.getElementById('live-hd-a').getElementsByTagName('SegmentTemplate')[0]
    const audioInitUrl = audioSegment.getAttribute('initialization')
    const audioUrl = audioSegment.getAttribute('media')

    const basicUrl = this.mpdUrl.replace(/\/dash-abr.*/,'') 
    this.requests
      .initializeVideoDownloader(basicUrl + videoUrl.replace(/^\.\./, ''))
      .initializeAudioDownloader(basicUrl + audioUrl.replace(/^\.\./, ''))

    const { ok: videoBlobOk, blob: videoInitBlob } = await this.requests.getSegment(basicUrl + videoInitUrl.replace(/^\.\./, ''))
    if (!videoBlobOk) {
      return {
        status: 'fail',
        message: 'Can\t download initial video segment',
      }
    }
    this.videoInitBlob = videoInitBlob
    this.videoSize += videoInitBlob.size      
    const { ok: audioBlobOk, blob: audioInitBlob } = await this.requests.getSegment(basicUrl + audioInitUrl.replace(/^\.\./, ''))
    if (!audioBlobOk) {
      return {
        status: 'fail',
        message: 'Can\t download initial audio segment',
      }
    }
    this.audioInitBlob = audioInitBlob
    this.audioSize += audioInitBlob.size
    this.initialised = true
    this.dispatchEvent(new Event('initilised'))
    return {
      status: 'success',
      message: `Stream recorder initialised. Mpd url: ${this.mpdUrl}`,
    }
  }

  async initializeWithUserId(userId) {
    if (this.initialised) {
      return {
        status: 'success',
        message: `Stream recorder initialised. Mpd url: ${this.mpdUrl}`,
      }
    }

    this.userId = userId
    const { ok: stremInfoRequestOk, json: streamInfo } = await this.requests.getStreamInfo(this.userId)
    if (!stremInfoRequestOk) {
      return { 
        status: 'fail',
        message: `Can't get stream info`,
      }
    }
    
    this.mediaId = streamInfo.media_id
    return this.initializeWithMpdUrl(streamInfo.dash_abr_playback_url)          
  }

  async initializeWithUsername(username) {
    if (this.initialised) {
      return {
        status: 'success',
        message: `Stream recorder initialised. Mpd url: ${this.mpdUrl}`,
      }
    }

    this.username = username
    const { ok: usernameRequestOk, json: userInfo } = await this.requests.getUsernameInfo(this.username)
    if (!usernameRequestOk) {
      return { 
        status: 'fail',
        message: `Can't find user info`,
      }
    }
    return this.initializeWithUserId(userInfo.data.user.id)         
  }

  async startRecording(verbose) {
    if (!this.initialised) {
      throw new Error('LiveVideoRecorder is\'t initialised')
    }

    if (this.streamIsOver) {
      verbose && console.log('Stream is over')
      return {
        status: 'over',
        message: 'Stream is over',
      }
    }
    
    this.recording = true
    this.dispatchEvent(new Event('started'))
    while (!this.shouldStop && !this.streamIsOver) {
      const { ok: mpdRequestOk, xml: mpdXml } = await this.requests.getMpd(this.mpdUrl)
      if (!mpdRequestOk) {
        this.streamIsOver = true
        this.recording = false
        verbose && console.log('Stream is over')
        this.dispatchEvent(new Event('stream-is-over'))
        this.dispatchEvent(new Event('stopped'))
        this.videoStream.end()
        this.audioStream.end()
        return {
          status: 'over',
          message: 'Stream is over',
        }
      }
      
      const timelineParts = mpdXml.getElementById('live-hd-v').getElementsByTagName('S')
      const parts = []

      for (let i = 0; i < timelineParts.length; i++) {
        const part = timelineParts[i]
        const partNumber = part.getAttribute('t')
        if (!this.downloadedParts.has(partNumber)) {
          const duration = part.getAttribute('d')
          parts.push([partNumber, duration])
          this.downloadedParts.add(partNumber)
          this.durations.add(duration)
        }   
      }

      if (parts.length === 0) {
        this.streamIsOver = true
        this.recording = false
        this.dispatchEvent(new Event('stream-is-over'))
        this.dispatchEvent(new Event('stopped'))
        verbose && console.log('Stream is over')
        this.videoStream.end()
        this.audioStream.end()
        return {
          status: 'over',
          message: 'Stream is over',
        }
      }
    
      for (const [partNumber] of parts) {
        const { ok: videoSegmentOk, blob: curVideoSegment } = await this.requests.downloadVideoSegment(partNumber)
        if (!videoSegmentOk) {
          continue
        }
            
        const { ok: audioSegmentOk, blob: curAudioSegment } = await this.requests.downloadAudioSegment(partNumber)
        if (!audioSegmentOk) {
          continue
        }

        this.videoStream.write(curVideoSegment)
        this.audioStream.write(curAudioSegment)
        this.dispatchEvent(new DetailedEvent('segment-downloaded', { details: {
          segmentNumber: partNumber,
          videoSize: curVideoSegment.size,
          audioSize: curAudioSegment.size,
        }}))
        
        this.videoSize += curVideoSegment.size
        this.audioSize += curAudioSegment.size
      }

      for (let i = 0; i < 12 && !this.shouldStop; i++) {
        await delay(1000) 
      }          
    }

    this.videoStream.end()
    this.audioStream.end()

    this.recording = false
    if (this.shouldStop) {
      verbose && console.log('Recording stopped by user')
      this.dispatchEvent(new Event('stopped-by-user'))
      this.shouldStop = false
    }
    
    this.dispatchEvent(new Event('stopped'))    
    return {
      status: 'stopped',
      message: 'Recording has been stopped',
    }
  }

  getDataStreams() {
    return {
      videoStream: this.videoStream,
      audioStream: this.audioStream,
    }
  }

  stopRecording() {
    return new Promise((resolve) => {
      if (!this.recording || this.streamIsOver) {
        resolve()
      }

      this.addEventListener('stopped', () => resolve(), { once: true })
      this.shouldStop = true
    })    
  }

  async tryFetchBack(verbose) {
    const durations = this.durations.getPossibleDurationsList()
    const curSegmentsNumber = this.pastVideoBlobs.length
    if (durations.length === 0) {
      return {
        status: 'fail',
        message: 'Possible durations list is empty. Try to record stream first',
      }
    }
    let previousFound = true

    this.dispatchEvent(new Event('fetchback-started'))
    verbose && console.log('Trying to fetch begining of the stream')
    while (previousFound && this.firstSegment > 200) {
      previousFound = false
      for (const duration of durations) {
        await delay(300)
        const segment = this.firstSegment - duration
        if (segment < 0) {
          continue
        }

        const { ok: videoSegmentOk, blob: curVideoSegment } = await this.requests.downloadVideoSegment(segment)
        if (!videoSegmentOk) {
          continue
        }
            
        const { ok: audioSegmentOk, blob: curAudioSegment } = await this.requests.downloadAudioSegment(segment)
        if (!audioSegmentOk) {
          continue
        }

        this.pastVideoBlobs.push(curVideoSegment)
        this.pastAudioBlobs.push(curAudioSegment)

        verbose && console.log(`Found segment ${segment}`)
        this.dispatchEvent(new DetailedEvent('past-segment-downloaded', { details: {
          videoSize: curVideoSegment.size,
          audioSize: curAudioSegment.size,
        }}))
        
        this.pastVideoSize += curVideoSegment.size
        this.pastAudioSize += curAudioSegment.size
        
        previousFound = true
        this.firstSegment = segment    
        break    
      }
  
      if (!previousFound) {
       verbose && console.log(`Can't find previous segment. Last segment found: ${this.firstSegment}`)
      }
    }
    verbose && console.log(`FetchBack found ${this.pastVideoBlobs.length - curSegmentsNumber} segments`)
    this.dispatchEvent(new Event('fetchback-stopped'))
    
    for (const videoBlob of this.pastVideoBlobs.reverse()) {
      this.pastVideoStream.write(videoBlob)
    }
    this.pastVideoStream.end()
    for (const audioBlob of this.pastAudioBlobs.reverse()) {
      this.pastAudioStream.write(audioBlob)
    }
    this.pastAudioStream.end()
    return {
      status: 'success',
      message: 'FetchBack is done',
    }
  }

  getPastDataStreams() {
    return {
      pastAudioStream: this.pastAudioStream,
      pastVideoStream: this.pastVideoStream,
    }
  }
}