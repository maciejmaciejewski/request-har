import { writeFileSync } from 'fs'
import { parse } from 'query-string'
import cookie = require('cookie');

export class RequestHar {
  private harEntriesArray = []
  private firstRequestTime
  private requestModule

  constructor (requestModule) {
    this.requestModule = requestModule;
    this.firstRequestTime = null;
  }

  request (options: any) {
    Object.assign(options, { time: true })
    return this.requestModule(options, (error, incomingMessage, response) => {
      if (!error) {
        let newEntry = this.createNewHarEntry(incomingMessage)
        this.harEntriesArray.push(newEntry)
      }

      if (typeof options.callback === 'function') {
        options.callback.apply(null, arguments);
      }
    })
  }

  clearHarEntries () {
    this.harEntriesArray = []
    this.firstRequestTime = null;
  }

  private createNewHarEntry(response) {
    let startedDateTime = new Date(response.request.startTime)
    if(this.firstRequestTime === null) {
      this.firstRequestTime = startedDateTime;
    }

    let entry = {
      startedDateTime: startedDateTime,
      time: response.elapsedTime,
      request: {
        method: response.request.method,
        url: response.request.uri.href,
        httpVersion: `HTTP/${response.httpVersion}`,
        cookies: this.getCookies(response.request.headers['Cookie']),
        headers: this.getHeaders(response.request.headers),
        queryString: this.getQueryStringParams(response.request.uri.search),
        //TODO: ADD CALCULATIONS OF HEADER AND SIZE
        headersSize: -1,
        bodySize: -1,
        ...((response.request.body) && {
          postData: {
            mimeType: response.request.headers['Content-Type'],
            text: response.request.body
          }
        })
      },
      response: {
        status: response.statusCode,
        statusText: response.statusMessage,
        httpVersion: `HTTP/${response.httpVersion}`,
        cookies: [],
        headers: this.getHeaders(response.headers),
        content: {
          size: response.body.length,
          mimeType: response.headers['content-type'] ? response.headers['content-type'] : 'text/plain',
          text: response.body
        },
        redirectURL: '',
        headersSize : -1,
        bodySize : response.body.length
      },
      cache: {},
      timings: {
        'blocked': this.toMs(response.timingPhases.wait),
        'dns': this.toMs(response.timingPhases.dns),
        'connect': this.toMs(response.timingPhases.tcp),
        'send': 0,
        'wait': this.toMs(response.timingPhases.firstByte),
        'receive': this.toMs(response.timingPhases.download)
      }
    }

    return entry
  }

  private getHeaders (headersObject) {
    return this.transformToKVArray(headersObject)
  }

  private getQueryStringParams (qs) {
    return this.transformToKVArray(parse(qs))
  }

  private getCookies (cookieHeader) {
    if(cookieHeader) {
      let parsedCookie = cookie.parse(cookieHeader)
      return  this.transformToKVArray(parsedCookie)
    } else {
      return []
    }
  }

  private toMs (num) {
    return Math.round(num * 1000) / 1000;
  }

  private transformToKVArray (obj) {
    return obj ? Object.keys(obj).map((key) => {
      return {
        name: key,
        value: obj[key].toString()
      }
    }) : []
  }

  saveFile (filePath){
    let generatedHar = {
      log: {
        version: '1.2',
        creator: {
          name: 'request-har',
          version: '1.0.0'
        },
        pages: [],
        entries: this.harEntriesArray
      }
    }

    writeFileSync(filePath, JSON.stringify(generatedHar, null, 2));
  }
}
