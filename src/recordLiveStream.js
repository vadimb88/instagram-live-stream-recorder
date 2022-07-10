import { DOMParser } from 'xmldom'
import NodeInstaRequests from './NodeInstaRequests.js'
import HttpsProxyAgent from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'
import LiveVideoRecorder from './LiveVideoRecorder.js'
import { createWriteStream, createReadStream } from 'fs'
import { rm } from 'fs/promises'
import { resolve } from 'path'
import { finished } from 'node:stream/promises'
import ffmpeg from 'fluent-ffmpeg'
import ansiEscapes from 'ansi-escapes'


const rnd = Math.floor(Math.random() * 100000)

async function makeRecords (liveRecorder, tryToFetchBegining, leaveTemp, verbose, dirname) {
  const startTime = liveRecorder.startTime
  const videoTempPath = resolve(dirname, 'temp', `${startTime}-video-temp-${startTime}_${rnd}.m4v`)
  const audioTempPath = resolve(dirname, 'temp', `${startTime}-audio-temp-${startTime}_${rnd}.m4a`)
  const tempVideoOutput = createWriteStream(videoTempPath)
  const tempAudioOutput = createWriteStream(audioTempPath)
  const initialVideoBuffer = Buffer.from(await liveRecorder.videoInitBlob.arrayBuffer())
  const initialAudioBuffer = Buffer.from(await liveRecorder.audioInitBlob.arrayBuffer())
  if (!tryToFetchBegining) {
    tempVideoOutput.write(initialVideoBuffer)
    tempAudioOutput.write(initialAudioBuffer)
  }
  const { videoStream, audioStream } = liveRecorder.getDataStreams()
 
  videoStream.pipe(tempVideoOutput)
  audioStream.pipe(tempAudioOutput)
 
  await liveRecorder.startRecording()
  await finished(videoStream)
  await finished(audioStream)
  if (tryToFetchBegining) {
    const videoPath = resolve(dirname, 'temp', `${startTime}-video-${startTime}_${rnd}.m4v`)
    const audioPath = resolve(dirname, 'temp', `${startTime}-audio-${startTime}_${rnd}.m4a`)

    const videoOutput = createWriteStream(videoPath)
    const audioOutput = createWriteStream(audioPath)

    const { pastVideoStream, pastAudioStream } = liveRecorder.getPastDataStreams()
    videoOutput.write(initialVideoBuffer)
    audioOutput.write(initialAudioBuffer)    
    pastVideoStream.pipe(videoOutput, { end: false })
    pastAudioStream.pipe(audioOutput, { end: false })

    await liveRecorder.tryFetchBack(verbose)
    await finished(pastVideoStream)
    await finished(pastAudioStream)
    createReadStream(videoTempPath).pipe(videoOutput)
    createReadStream(audioTempPath).pipe(audioOutput)
    await finished(videoOutput)
    await finished(audioOutput)
    if (!leaveTemp) {
      rm(videoTempPath)
      rm(audioTempPath)
    }
    
    return {
      startTime,
      videoPath,
      audioPath, 
    }
  }

  return {
    startTime,
    videoPath: videoTempPath,
    audioPath: audioTempPath,
  }
}

export async function recordLiveStream ({ 
  username, 
  userId, 
  mpdUrl, 
  csrfToken, 
  sessionId, 
  proxy, 
  getFull: tryToFetchBegining,
  ffmpegOutputOptions,
  outputFile,
  leaveTemp,
  verbose,
  dirname,
 }) {
  const eventLoopFix = () => setTimeout(eventLoopFix, 99999999)
  const fixTimeout = setTimeout(eventLoopFix, 99999999)
 
  let agent
  if (proxy) {
    if (proxy.startsWith('http')) {
      agent = new HttpsProxyAgent(proxy)
    } else if (proxy.startsWith('socks')) {
      agent = new SocksProxyAgent(proxy)
    }
  }
  
  const insta = new NodeInstaRequests({
    csrfToken,
    sessionId,
    agent,
    xmlParser: new DOMParser(),
  })
  const liveRecorder = new LiveVideoRecorder(insta)
  const saveAndExitSignal = () => liveRecorder.stopRecording()
  if (verbose) {
    liveRecorder.addEventListener('segment-downloaded', (e) => {
      console.log(`Segment ${e.details.segmentNumber} downloaded`)
    })
  }
  let initStatus
 
  let outputRecordFile
  if (mpdUrl) {
    initStatus = await liveRecorder.initializeWithMpdUrl(mpdUrl)
    outputRecordFile = `${username  || userId || 'record_'}${liveRecorder.startTime}_live_${rnd}.mp4`    
  } else if (userId) {
    initStatus = await liveRecorder.initializeWithUserId(userId) 
    outputRecordFile = `${username || userId}_${liveRecorder.startTime}_live_${rnd}.mp4`    
  } else if (username) {
    initStatus = await liveRecorder.initializeWithUsername(username)
    outputRecordFile = `${username}_${liveRecorder.startTime}_live_${rnd}.mp4`
  } else {
    throw new Error('You need to provide mpdUrl, userId or username')
  }
  const outputRecordPath = outputFile || resolve(dirname, 'output', outputRecordFile )
    

  if (initStatus.status === 'fail') {
    return { result: initStatus }
  }
  verbose && console.log(`Username: ${liveRecorder.username}`)
  verbose && console.log(`User id: ${liveRecorder.userId}`)
  verbose && console.log(`Media id: ${liveRecorder.mediaId}`)
  verbose && console.log(`First segment: ${liveRecorder.firstSegment}`)
  const result = makeRecords(liveRecorder, tryToFetchBegining, leaveTemp, verbose, dirname)
    .then((records) => {
      if (!records.startTime) {
        console.log(records)
        throw new Error('Something went wrong')
      }
      return mergeFiles({ ...records, outputFile: outputRecordPath, ffmpegOutputOptions, verbose }).then(async (result) => { 
        if (!leaveTemp) {
          await rm(records.videoPath)
          await rm(records.audioPath)
        }        
        clearTimeout(fixTimeout)
        return result
      })
    })
  
  return {
    result,
    saveAndExitSignal,
  }  
}

function mergeFiles({ videoPath, audioPath, outputFile, ffmpegOutputOptions, verbose }) {
  let showProgress = () => {}
  if (verbose) {
    showProgress = (progress) => {
      process.stdout.write(ansiEscapes.eraseLines(1) + `Ffmpeg processing: ${progress?.percent?.toFixed(2) ?? 100}% done`)
    }    
  }
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions(ffmpegOutputOptions || [
        '-c:v copy',
        '-c:a aac'
      ])
      .on('progress', showProgress)
      .on('end', () =>   {
        verbose && console.log('\nFfmpeg processing has been finished')
        resolve({
          outputFile,
          status: 'success'
        })
      })
      .on('error', (err) => reject(err))      
      .save(outputFile)
  })
}
