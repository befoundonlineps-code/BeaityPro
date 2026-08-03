const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

const customJestConfig = {
  testEnvironment: 'node',
  // Runs before the modules under test are loaded, which is the only moment
  // that helps: lib/supabaseClient builds its client at import time.
  setupFiles: ['<rootDir>/jest.setup.js'],
}

module.exports = createJestConfig(customJestConfig)
