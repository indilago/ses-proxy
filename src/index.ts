import net from 'net'
import SesSender, {MsgClient, SesSenderOptions} from './SesSender'

let sesSender: SesSender

function createClient(): MsgClient {
  return {
    from: undefined,
    to: [],
    subject: '',
    isReadingData: false,
    data: '',
  }
}

const server = net.createServer(function (c) { //'connection' listener
  console.log('client connected')
  setTimeout(() => c.write('220 localhost ESMTP Postfix\r\n'), 100)
  
  let client = createClient()
  
  c.on('end', () => console.log('client disconnected.'))
  c.on('error', error => console.log('socket error', error))
  c.on('drain', (...args) => console.log('socket drain', args))
  c.on('timeout', (...args) => console.log('socket timeout', args))
  c.on('data', (dataRaw) => {
    const data = dataRaw.toString()
    
    if (typeof client.data !== 'string') {
      throw new Error(`Expected message data to be a string, ${typeof client.data} given`)
    }
    
    if (client.isReadingData) {
      client.data += data
      
      const terminationIndex = client.data.indexOf('\r\n.\r\n')
      if (terminationIndex !== -1) {
        client.data = client.data.substring(0, terminationIndex)
        client.isReadingData = false
        console.log('Message received.', client)
        sesSender.queue(client)
        client = createClient()
        c.write('250 Ok: queued as ' + sesSender.messageQueue.length() + '\r\n')
      }
    } else {
      console.log('client sent command', data)
      
      switch (true) {
        case data.indexOf('EHLO') === 0:
          c.write('250-localhost Hello localhost [10.253.5.75]\r\n')
          c.write('250-PIPELINING\r\n')
          c.write('250 HELP\r\n')
          break
        
        case data.indexOf('HELO') === 0:
          c.write('250 localhost\r\n')
          break
        
        case data.indexOf('MAIL FROM:') === 0:
          client.from = data.substring('MAIL FROM:'.length)
          c.write('250 2.1.0 Sender OK\r\n')
          break
        
        case data.indexOf('RCPT TO:') === 0:
          client.to.push(data.substring('RCPT TO:'.length))
          c.write('250 Ok\r\n')
          break
        
        case data.indexOf('DATA') === 0:
          client.isReadingData = true
          c.write('354 End data with <CR><LF>.<CR><LF>\r\n')
          
          break
        
        case data.indexOf('QUIT') === 0:
          c.end('221 Bye\n')
          
          break
        
        default:
          c.write('500 unrecognized command\r\n')
          console.warn('500 unrecognized command')
      }
    }
  })
})

let port = 25
let portSpecified = false
let options: SesSenderOptions

function start(port: number) {
  server.listen(port)
}

server.on('listening', () => {
  console.log('Started SES-Proxy on port', port)
  sesSender = new SesSender(options)
})

server.on('error', (err: Error) => {
  const errorCode = (err as any).code as string
  console.log('Error starting server on port', port, errorCode)
  if (errorCode === 'EACCES' || errorCode === 'EADDRINUSE') {
    if (portSpecified) {
      console.log('Aborting')
    } else {
      port = 2525
      console.log('Trying port', port)
      start(port)
    }
  } else {
    throw err
  }
})

export default function startServer(opts: SesSenderOptions) {
  options = opts
  if (options.port) {
    portSpecified = true
    port = typeof options.port === 'string' ? parseInt(options.port, 10) : options.port
  }
  start(port)
}
