exports.yargs = {
    command: 'travis <command>',
    describe: 'Travis CI inspection utility',

    builder: (yargs) => {
        yargs.command(require('./sub/dump').yargs)
    }
}
