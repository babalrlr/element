/* eslint-disable */
class ExitPlugin {
    apply(compiler) {
        compiler.hooks.done.tap('DonePlugin', (stats) => {
            console.log('Compile is done !')
            setTimeout(() => {
                process.exit(0)
            })
        });
    }
}
module.exports = ExitPlugin;