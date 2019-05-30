const { Scheduler } = require('@pown/request/lib/scheduler')

const scheduler = new Scheduler()

const travisFetch = async(href) => {
    href = href.replace(/^\/+/, '')

    const { responseCode, responseBody } = await scheduler.fetch(`https://api.travis-ci.org/${href}`, { 'Travis-API-Version': 3 })

    if (responseCode === 429) {
        return await travisFetch(href)
    }
    else {
        return JSON.parse(responseBody.toString())
    }
}

const travisFetchPages = async(href) => {
    const pages = []

    do {
        const page = await travisFetch(href)

        pages.push(page)

        const { '@pagination': pagination } = page || {}
        const { next: paginationNext } = pagination || {}
        const { '@href': paginationNextHref } = paginationNext || {}

        href = paginationNextHref
    } while (href)

    return pages
}

const getOwner = async(ownerId) => {
    return await travisFetch(`/owner/${ownerId}`)
}

const listRepositories = async(ownerId) => {
    return await travisFetchPages(`/owner/${ownerId}/repos`)
}

const listRepositoryRequests = async(repositoryId) => {
    return await travisFetchPages(`/repo/${repositoryId}/requests`)
}

const getRepositoryRequest = async(repositoryId, requestId) => {
    return await travisFetch(`/repo/${repositoryId}/request/${requestId}?include=request.builds%2Crequest.commit%2Crequest.raw_configs`)
}

const getJobLog = async(jobId) => {
    const { responseBody, responseHeaders } = await scheduler.fetch(`https://api.travis-ci.org/jobs/${jobId}/log.txt`)

    const { location } = responseHeaders

    let log

    if (location) {
        const { responseBody } = await scheduler.fetch(location)

        log = responseBody
    }
    else {
        log = responseBody
    }

    return log
}

module.exports = {
    travisFetch,
    travisFetchPages,
    getOwner,
    listRepositories,
    listRepositoryRequests,
    getRepositoryRequest,
    getJobLog
}
