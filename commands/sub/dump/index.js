exports.yargs = {
    command: 'dump <owner>',
    describe: 'Dump travis repositories, requests and logs',

    builder: (yargs) => {
        yargs.option('concurrency', {
            describe: 'Number of concurrent requests',
            type: 'number',
            default: 100,
            alias: 'c'
        })
    },

    handler: async(argv) => {
        const { concurrency, owner } = argv

        const fs = require('fs')
        const path = require('path')
        const util = require('util')
        const { Bar } = require('@pown/cli/lib/bar')

        const mkdir = util.promisify(fs.mkdir)
        const writeFile = util.promisify(fs.writeFile)

        let total = 0

        const bar = new Bar({ clearOnComplete: true })

        bar.start(total, 0)

        const save = async(pathname, data) => {
            await mkdir(path.dirname(pathname), { recursive: true })
            await writeFile(pathname, data)
        }

        const dumps = (object) => {
            return JSON.stringify(object, '', '  ')
        }

        const exec = async(tasks) => {
            total += tasks.length

            bar.setTotal(total)

            await Promise.all(tasks.map(async(task) => {
                await task

                bar.increment()
            }))
        }

        const Travis = require('../../../lib/travis')

        const travis = new Travis({ maxConcurrent: concurrency })

        travis.on('log', console.log.bind(console))
        travis.on('info', console.info.bind(console))
        travis.on('warn', console.warn.bind(console))
        travis.on('error', console.error.bind(console))
        travis.on('debug', console.debug.bind(console))

        const repositoryPages = await travis.listRepositories(owner)

        const ownerPrefix = path.join(owner)

        await save(path.join(ownerPrefix, 'repository-pages.json'), dumps(repositoryPages))

        await exec(repositoryPages.map(async({ repositories = [] }) => {
            await exec(repositories.map(async({ id: repositoryId }) => {
                const repositoryRequestPages = await travis.listRepositoryRequests(repositoryId)

                const repositoryPrefix = path.join(ownerPrefix, `${repositoryId}`)

                await save(path.join(repositoryPrefix, 'request-pages.json'), dumps(repositoryRequestPages))

                await exec(repositoryRequestPages.map(async({ requests = [] }) => {
                    await exec(requests.map(async({ id: requestId }) => {
                        const request = await travis.getRepositoryRequest(repositoryId, requestId)

                        const requestPrefix = path.join(repositoryPrefix, `${requestId}`)

                        await save(path.join(requestPrefix, 'request.json'), dumps(request))

                        await exec(request.raw_configs.map(async({ config }, id) => {
                            await save(path.join(requestPrefix, `config-${id}.yaml`), config)
                        }))

                        await exec(request.builds.map(async({ jobs = [] }) => {
                            await exec(jobs.map(async({ id: jobId }) => {
                                const log = await travis.getJobLog(jobId)

                                const jobPrefix = requestPrefix

                                await save(path.join(jobPrefix, `${jobId}.log`), log)
                            }))
                        }))
                    }))
                }))
            }))
        }))

        bar.stop()
    }
}
