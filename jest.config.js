module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
      '^(admin|site|charts|friends|db|settings)(/?.*)$': '<rootDir>/$1$2'
  }
};