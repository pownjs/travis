const { EventEmitter } = require('events')
const { sleep } = require('@pown/async/lib/sleep')
const { Scheduler } = require('@pown/request/lib/scheduler')

class Travis extends EventEmitter {
    constructor(options) {
        super()

        const { retryCount = 30, retryDelay = 30000, ...rest } = options || {}

        this.scheduler = new Scheduler({ maxConcurrent: 100, ...rest })

        this.retryCount = retryCount
        this.retryDelay = retryDelay
    }

    async travisFetch(uri, headers = {}) {
        let transaction

        for (let i = 0; i < this.retryCount; i++) {
            transaction = await this.scheduler.request({ uri, headers, follow: true })

            const { responseCode, responseBody, info } = transaction

            if (responseCode === 429 || info.error) {
                if (i == this.retryCount) {
                    this.emit('warn', `failed ${uri} -> ${responseCode} => ${info.error}`)

                    break
                }
                else {
                    await sleep(this.retryDelay)

                    this.emit('debug', `retrying ${uri} -> ${i}`)

                    continue
                }
            }
            else {
                return responseBody
            }
        }

        return
    }

    async travisApiFetch(href) {
        href = href.replace(/^\/+/, '')

        const data = await this.travisFetch(`https://api.travis-ci.org/${href}`, { 'Travis-API-Version': 3 })

        if (!data) {
            return {}
        }

        return JSON.parse(data.toString())
    }

    async travisApiFetchPages(href) {
        const pages = []

        do {
            const page = await this.travisApiFetch(href)

            pages.push(page)

            const { '@pagination': pagination } = page || {}
            const { next: paginationNext } = pagination || {}
            const { '@href': paginationNextHref } = paginationNext || {}

            href = paginationNextHref
        } while (href)

        return pages
    }

    async getOwner(ownerId) {
        return await this.travisApiFetch(`/owner/${ownerId}`)
    }

    async listRepositories(ownerId) {
        return await this.travisApiFetchPages(`/owner/${ownerId}/repos`)
    }

    async listRepositoryRequests(repositoryId) {
        return await this.travisApiFetchPages(`/repo/${repositoryId}/requests`)
    }

    async getRepositoryRequest(repositoryId, requestId) {
        return await this.travisApiFetch(`/repo/${repositoryId}/request/${requestId}?include=request.builds%2Crequest.commit%2Crequest.raw_configs`)
    }

    async getJobLog(jobId) {
        return await this.travisFetch(`https://api.travis-ci.org/jobs/${jobId}/log.txt`)
    }
}

module.exports = Travis
