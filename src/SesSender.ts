import fs from 'fs'
import path from 'path'
import * as AWS from 'aws-sdk'
import proxyAgent from 'proxy-agent'
import async, {ErrorCallback} from 'async'
import {
  EmailAddressList,
  MessageTagList,
  RawMessageData,
  SendEmailRequest,
} from 'aws-sdk/clients/sesv2'

export interface MsgClient {
  data: RawMessageData
  to: EmailAddressList
  from?: string
  subject: string
  isReadingData: boolean
}

export interface SesSenderOptions {
  config?: string
  proxy?: string
  port?: string | number
}

export default class SesSender {
  public readonly messageQueue: async.AsyncQueue<MsgClient>
  private readonly ses: AWS.SESV2
  private readonly emailTags?: MessageTagList
  private readonly configurationSetName?: string
  
  constructor(opts: SesSenderOptions) {
    const credentialsFilePath = opts.config || './ses-credentials.json'
    
    if (fs.existsSync(credentialsFilePath)) {
      AWS.config.loadFromPath(credentialsFilePath)
    } else if (fs.existsSync(path.join(process.cwd(), credentialsFilePath))) {
      AWS.config.loadFromPath(path.join(process.cwd(), credentialsFilePath))
    } else {
      console.debug('No AWS credentials file; using environment')
    }
    this.ses = new AWS.SESV2()
    
    const proxy = opts.proxy || process.env.HTTPS_PROXY
    
    if (proxy) {
      console.log('Using https proxy', proxy)
      AWS.config.update({
        httpOptions: {
          agent: proxyAgent(proxy),
        },
      })
    }
    
    if (process.env.CONFIGURATION_SET_NAME) {
      this.configurationSetName = process.env.CONFIGURATION_SET_NAME
      console.debug('Using configuration set', this.configurationSetName)
    }
    
    if (process.env.EMAIL_TAGS) {
      this.emailTags = process.env.EMAIL_TAGS.split(',')
          .map(tag => {
            const [Name, Value] = tag.trim().split('=')
            return { Name, Value }
          })
      console.debug('Parsed email tags', this.emailTags)
    }
    
    // create a queue object with concurrency 1
    this.messageQueue = async.queue((client, callback) => this.sendRaw(client, callback), 1)
  }
  
  queue(client: MsgClient) {
    this.messageQueue.push(client)
  }
  
  async sendRaw(client: MsgClient, callback: ErrorCallback) {
    const params: SendEmailRequest = {
      Content: {
        Raw: {
          Data: client.data,
        },
      },
      Destination: {
        ToAddresses: client.to,
      },
      ConfigurationSetName: this.configurationSetName,
      EmailTags: this.emailTags,
    }
    
    console.debug('Attempting to send SES message')
    return this.ses.sendEmail(params).promise()
        .then(result => {
          console.debug(`Sent msg ${result.MessageId} to ${client.to.join(', ')}`)
          callback()
        })
        .catch(err => {
          console.error('Error sending SES email', err)
          console.error(err.stack)
          callback(err)
        })
  }
}
