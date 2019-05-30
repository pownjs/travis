const { sleep } = require('@pown/async/lib/timers')
const { Scheduler } = require('@pown/request/lib/scheduler')

const scheduler = new Scheduler()

const travisFetch = async(url, headers = {}, options = {}) => {
    const { responseCode, responseBody, info } = await scheduler.fetch(url, headers, { follow: true })

    if (responseCode === 429 || info.error) {
        const { count = 1 } = options

        await sleep(count * 1000)

        return await travisFetch(url, headers, { count: count + 1 })
    }
    else {
        return responseBody
    }
}

const travisApiFetch = async(href) => {
    href = href.replace(/^\/+/, '')

    const data = await travisFetch(`https://api.travis-ci.org/${href}`, { 'Travis-API-Version': 3 })

    return JSON.parse(data.toString())
}

const travisApiFetchPages = async(href) => {
    const pages = []

    do {
        const page = await travisApiFetch(href)

        pages.push(page)

        const { '@pagination': pagination } = page || {}
        const { next: paginationNext } = pagination || {}
        const { '@href': paginationNextHref } = paginationNext || {}

        href = paginationNextHref
    } while (href)

    return pages
}

const getOwner = async(ownerId) => {
    return await travisApiFetch(`/owner/${ownerId}`)
}

const listRepositories = async(ownerId) => {
    return await travisApiFetchPages(`/owner/${ownerId}/repos`)
}

const listRepositoryRequests = async(repositoryId) => {
    return await travisApiFetchPages(`/repo/${repositoryId}/requests`)
}

const getRepositoryRequest = async(repositoryId, requestId) => {
    return await travisApiFetch(`/repo/${repositoryId}/request/${requestId}?include=request.builds%2Crequest.commit%2Crequest.raw_configs`)
}

const getJobLog = async(jobId) => {
    return await travisFetch(`https://api.travis-ci.org/jobs/${jobId}/log.txt`)
}

module.exports = {
    travisApiFetch,
    travisApiFetchPages,
    getOwner,
    listRepositories,
    listRepositoryRequests,
    getRepositoryRequest,
    getJobLog
}
