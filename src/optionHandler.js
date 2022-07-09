import minimist from 'minimist'
import { readFileSync } from 'fs'

const filterUndefinedKeys = (obj) => Object.keys(obj).reduce((acc, key) => {
  if (obj[key] !== undefined) {
    acc[key] = obj[key]
  }
  return acc
}, {})

const getConfigOptions = (config) => {
  const defaultConfigFile = 'config.default.json'
  
  if (config) {
    let configData
    try {
      configData = readFileSync(config)
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw(err)
      }
      console.log(`Can\'t find config ${config}`)
      process.exit()
    }
  
    try {
      const configOptions = JSON.parse(configData)
      return configOptions
    } catch(err) {
      if (err instanceof SyntaxError) {
        console.log(`Can't parse config ${config}. Check json syntax.`)
        process.exit()
      }
      throw(err)
    }
  } else {
    let configData
    try {
      configData = readFileSync(defaultConfigFile)
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw(err)
      }
      return {}
    }
    try {
      const configOptions = JSON.parse(configData)
      return configOptions
    } catch(err) {
      if (err instanceof SyntaxError) {
        console.log(`Can't parse config ${defaultConfigFile}. Check json syntax.`)
        process.exit()
      }
      throw(err)
    }
  }
}

export async function handleOptions () {
  let { 
    u: username,
    o: output,
    i: userId,
    m: mpdUrl,
    c: csrfToken,
    s: sessionId,
    p: proxy,
    'leave-temp': leaveTemp,
    'get-full': getFull,
    config,
    help,
    verbose, 
  } = minimist(process.argv.slice(2))
  

  if (help) {
    console.log(`
    -u: target username
    -i: target userId
    -m: target streams mpd manifext url
    -o: optional output file name
    -c: your csrfToken
    -s: your sessionId
    -p: proxy string
    --get-full: try to download full stream. Script will try to fetch parts of the stream which played before script's been started
    --leave-temp: don't delete temp files
    --help: this message
      
    You need to provide eather target username, or userId or url to streams mpd manifest. All other options are optional.`)
    process.exit(0)
  }

  const cliOptions = {
    username,
    output,
    userId,
    mpdUrl,
    csrfToken,
    sessionId,
    proxy,
    leaveTemp,
    getFull,
    verbose,
  }
  const configOptions = getConfigOptions(config)
  const options = { ...configOptions, ...filterUndefinedKeys(cliOptions) }
  const checkRestrictions = (options) => {
    const { username, userId, mpdUrl, csrfToken, sessionId } = options
    if (!username && !userId && !mpdUrl) {
      console.log('You need to provide eather target username, or userId or url to streams mpd file. Run with "--help" to get list of parameters')
      process.exit(0)
    }
    
    if (!mpdUrl && (!csrfToken || !sessionId)) {
      console.log('You need to provide both csrfToken and sessionId, if you don\t provide url to streams mpd file')
      process.exit(0)
    }
  }
  checkRestrictions(options)
  return options 
}