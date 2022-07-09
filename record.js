import { recordLiveStream } from './src/recordLiveStream.js'
import { handleOptions } from './src/optionHandler.js'

async function main () {
  const options = await handleOptions()
  options.verbose && console.log(options)
  const { result, saveAndExitSignal } = await recordLiveStream(options)
 
  function saveAndExit () {
    console.log('SIGINT')
    console.log('THe application will save records and exit. If you want to exit process immediately, send SIGINT one more time.')
    saveAndExitSignal()
    process.off('SIGINT', saveAndExit)
  }
  process.on('SIGINT', saveAndExit)

  return result
}

main().then((result) =>  {
  if (result.status === 'success') {
    console.log(result.outputFile)
  } else {
    console.log(result.message)
  }  
  process.exit(0)
}).catch((err) => console.log(err))