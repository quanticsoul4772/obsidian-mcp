// Set up test environment
process.env.NODE_ENV = 'test';

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});