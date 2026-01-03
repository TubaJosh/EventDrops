module.exports = {
    testEnvironment: 'jsdom',
    setupFiles: [
        './testSetup.js',
    ],
    moduleNameMapper: {
        '\\.css$': '<rootDir>/__mocks__/styleMock.js',
        '^d3$': '<rootDir>/node_modules/d3/dist/d3.js',
    },
    transform: {
        '^.+\\.js$': 'babel-jest',
    },
    transformIgnorePatterns: [
        'node_modules/(?!(d3|d3-[^/]+|internmap|delaunator|robust-predicates)/)',
    ],
};
