const { sleep } = require('@pown/async/lib/timers')
const { Scheduler } = require('@pown/request/lib/scheduler')

class Travis {
    constructor(options) {
        this.scheduler = new Scheduler({ maxConcurrent: 100, ...options })
    }

    async travisFetch(url, headers = {}, options = {}) {
        const { responseCode, responseBody, info } = await this.scheduler.fetch(url, headers, { follow: true })

        if (responseCode === 429 || info.error) {
            const { count = 1 } = options

            await sleep(count * 1000)

            return await this.travisFetch(url, headers, { count: count + 1 })
        }
        else {
            return responseBody
        }
    }

    async travisApiFetch(href) {
        href = href.replace(/^\/+/, '')

        const data = await this.travisFetch(`https://api.travis-ci.org/${href}`, { 'Travis-API-Version': 3 })

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
