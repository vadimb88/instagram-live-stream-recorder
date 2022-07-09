import fetch from 'node-fetch'

export default class NodeInstaRequests {
  constructor({ csrfToken, xmlParser, sessionId, agent, cookieString }) {
    this.csrfToken = csrfToken
    this.cookies = cookieString
    this.sessionId = sessionId
    this.xIgWWWClaim = '0'
    this.xmlParser = xmlParser
    this.xIgAppId = '936619743392459'   // chrome browser
    this.agent = agent
  }

  _handleHeaders(...headers) {
    for (const [header, value] of headers) {
      if (header === 'x-ig-set-www-claim') {
        this.xIgWWWClaim = value
      }
    }
  }

  getUsernameInfo(username) {
    if (!this.csrfToken) {
      throw new Error('Error: csrfToken is requered for getUsernameInfo request')
    }
    return fetch(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
    "headers": {
      "accept": "*/*",
      "accept-language": "en-US,en;q=0.9,ru;q=0.8",
      "sec-ch-ua": "\" Not A;Brand\";v=\"99\", \"Chromium\";v=\"102\", \"Google Chrome\";v=\"102\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Windows\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "x-asbd-id": "198387",
      "x-csrftoken": this.csrfToken,
      "x-ig-app-id": this.xIgAppId,
      "x-ig-www-claim": this.xIgWWWClaim,    
      "Referer": "https://www.instagram.com/",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    },
    "body": null,
    "method": "GET",
    agent: this.agent
    }).then(async (response) => {
      if (!response.ok) {
        return {
            ok: false,
            status: response.status
        }
      }
      this._handleHeaders(...response.headers)
      return {
          ok: true,
          status: response.status,
          json: await response.json()
      }
    }) 
  }

  getStreamInfo(userId) {
    if (!this.csrfToken) {
      throw new Error('Error: csrfToken is requered for getStreamInfo request')
    }

    if (!this.sessionId) {
      throw new Error('Error: sessionId is requered for getStreamInfo request')
    }

    return fetch(`https://i.instagram.com/api/v1/live/web_info/?target_user_id=${userId}`, {
      "headers": {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9,ru;q=0.8",
        "sec-ch-ua": "\" Not A;Brand\";v=\"99\", \"Chromium\";v=\"102\", \"Google Chrome\";v=\"102\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "x-asbd-id": "198387",
        "x-csrftoken": this.csrfToken,
        "x-ig-app-id": this.xIgAppId,
        "x-ig-www-claim": this.xIgWWWClaim,
        "cookie": `sessionid=${this.sessionId};`,
        "Referer": "https://www.instagram.com/",
        "Referrer-Policy": "strict-origin-when-cross-origin"
      },
      "body": null,
      "method": "GET",
      agent: this.agent
    }).then(async (response) => {
      if (!response.ok) {
        return {
            ok: false,
            status: response.status,
        }
      }
      this._handleHeaders(...response.headers)
      return {
          ok: true,
          status: response.status,
          json: await response.json(),
      }
    })
  }

  getMpd(mpdUrl) {
    return fetch(mpdUrl, {
      "headers": {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9,ru;q=0.8",
        "sec-ch-ua": "\" Not A;Brand\";v=\"99\", \"Chromium\";v=\"102\", \"Google Chrome\";v=\"102\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site",
        "Referer": "https://www.instagram.com/",
        "Referrer-Policy": "strict-origin-when-cross-origin"
      },
      "body": null,
      "method": "GET",
      agent: this.agent
    }).then(async (response) => {
      if (!response.ok) {
        return {
            ok: false,
            status: response.status
        }
      }
      this._handleHeaders(...response.headers)
      const text = await response.text()
      return {
          ok: true,
          status: response.status,
          xml: this.xmlParser.parseFromString(text, "application/xml")
      }
    })
  }

  getSegment(segmentUrl) {
    return fetch(segmentUrl, {
      "headers": {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9,ru;q=0.8",
        "sec-ch-ua": "\" Not A;Brand\";v=\"99\", \"Chromium\";v=\"102\", \"Google Chrome\";v=\"102\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site",
        "Referer": "https://www.instagram.com/",
        "Referrer-Policy": "strict-origin-when-cross-origin"
      },
      "body": null,
      "method": "GET",
      agent: this.agent,
    }).then(async (response) => {
      if (!response.ok) {
        return {
            ok: false,
            status: response.status
        }
      }
      this._handleHeaders(...response.headers)
      return {
          ok: true,
          status: response.status,
          blob: await response.blob()
      }
    })
  }

  downloadVideoSegment() {
    throw Error('call initializeVideoDownloader(videoUrlTemplate) first')
  }

  downloadAudioSegment() {
    throw Error('call initializeAudioDownloader(audioUrlTemplate) first')
  }

  initializeVideoDownloader(videoUrlTemplate) {
    const downloadVideoSegment = function(segment) {
      return this.getSegment(videoUrlTemplate.replace(/\$Time\$/, segment))
    }

    this.downloadVideoSegment = downloadVideoSegment.bind(this)
    return this
  }

  initializeAudioDownloader(audioUrlTemplate) {
    const downloadAudioSegment = function(segment) {
      return this.getSegment(audioUrlTemplate.replace(/\$Time\$/, segment))
    }

    this.downloadAudioSegment = downloadAudioSegment.bind(this)
    return this
  }
}