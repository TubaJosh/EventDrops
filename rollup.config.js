import resolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import css from 'rollup-plugin-css-only';
import terser from '@rollup/plugin-terser';
import json from '@rollup/plugin-json';

export default {
    input: 'src/index.js',
    output: {
        file: 'dist/index.js',
        format: 'umd',
        name: 'eventDrops',
        sourcemap: true,
    },
    plugins: [
        json(),
        css({ output: 'dist/style.css' }),
        resolve(),
        babel({
            babelHelpers: 'bundled',
            exclude: 'node_modules/**',
        }),
        commonjs(),
        terser(),
    ],
    external: ['d3'],
};
