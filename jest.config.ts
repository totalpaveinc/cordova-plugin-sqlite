
import type {Config} from '@jest/types';

export const JEST_CONFIG: Config.InitialOptions = {
    preset: 'ts-jest',
    verbose: false,
    collectCoverage: true,
    setupFiles: [
        "./spec/support/mocks.ts"
    ],
    testPathIgnorePatterns: [
        './third_party/'
    ],
    testEnvironment: 'jest-environment-jsdom'
};

export default JEST_CONFIG;
