
const Path = require('path');

module.exports = {
    entry: './src/index.ts',
    mode: 'development',
    output: {
        filename: 'app.js',
        path: Path.resolve(__dirname, 'www/js')
    },
    module: {
        rules: [
            {
                test: /\.tsx?|\.d\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.d.ts', '.js']
    }
}
