exports.yargs = {
    command: 'dump <owner>',
    describe: 'Dump travis repositories, requests and logs',

    builder: (yargs) => {},

    handler: async(argv) => {
        const { owner } = argv

        const fs = require('fs')
        const path = require('path')
        const util = require('util')

        const { listRepositories, listRepositoryRequests, getRepositoryRequest, getJobLog } = require('../../../lib/index')

        const mkdir = util.promisify(fs.mkdir)
        const writeFile = util.promisify(fs.writeFile)

        const save = async(pathname, data) => {
            await mkdir(path.dirname(pathname), { recursive: true })
            await writeFile(pathname, data)
        }

        const dumps = (object) => {
            return JSON.stringify(object, '', '  ')
        }

        const repositoryPages = await listRepositories(owner)

        const ownerPrefix = path.join(owner)

        await save(path.join(ownerPrefix, 'repository-pages.json'), dumps(repositoryPages))

        await Promise.all(repositoryPages.map(async({ repositories = [] }) => {
            await Promise.all(repositories.map(async({ id: repositoryId }) => {
                const repositoryRequestPages = await listRepositoryRequests(repositoryId)

                const repositoryPrefix = path.join(ownerPrefix, `${repositoryId}`)

                await save(path.join(repositoryPrefix, 'request-pages.json'), dumps(repositoryRequestPages))

                await Promise.all(repositoryRequestPages.map(async({ requests = [] }) => {
                    await Promise.all(requests.map(async({ id: requestId }) => {
                        const request = await getRepositoryRequest(repositoryId, requestId)

                        const requestPrefix = path.join(repositoryPrefix, `${requestId}`)

                        await save(path.join(requestPrefix, 'request.json'), dumps(request))

                        await Promise.all(request.raw_configs.map(async({ config }, id) => {
                            await save(path.join(requestPrefix, `config-${id}.yaml`), config)
                        }))

                        await Promise.all(request.builds.map(async({ jobs = [] }) => {
                            await Promise.all(jobs.map(async({ id: jobId }) => {
                                const log = await getJobLog(jobId)

                                const jobPrefix = path.join(requestPrefix, `${jobId}`)

                                await save(path.join(jobPrefix, 'log.txt'), log)
                            }))
                        }))
                    }))
                }))
            }))
        }))
    }
}
