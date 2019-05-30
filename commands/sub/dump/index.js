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

        const repositoryPages = await listRepositories(owner)

        await Promise.all(repositoryPages.map(async({ repositories }) => {
            await Promise.all(repositories.map(async({ id: repositoryId }) => {
                const repositoryRequestPages = await listRepositoryRequests(repositoryId)

                await Promise.all(repositoryRequestPages.map(async({ requests }) => {
                    await Promise.all(requests.map(async({ id: requestId }) => {
                        const request = await getRepositoryRequest(repositoryId, requestId)

                        const requestPrefix = path.join(owner, repositoryId.toString(), requestId.toString())

                        await mkdir(requestPrefix, { recursive: true })

                        await Promise.all(request.raw_configs.map(async({ config }, id) => {
                            await writeFile(path.join(requestPrefix, `${id}.yaml`), config)
                        }))

                        await Promise.all(request.builds.map(async({ jobs }) => {
                            await Promise.all(jobs.map(async({ id: jobId }) => {
                                const jobPrefix = path.join(requestPrefix, jobId.toString())

                                await mkdir(jobPrefix, { recursive: true })

                                const log = await getJobLog(jobId)

                                await writeFile(path.join(jobPrefix, 'log.txt'), log)
                            }))
                        }))
                    }))
                }))
            }))
        }))
    }
}
