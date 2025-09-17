# Test Coverage Plan: 0% to 60% in 4 Weeks

## Executive Summary

This plan outlines a systematic approach to achieve 60% test coverage for the Obsidian MCP codebase (7,961 lines of TypeScript code across 23 files) within 4 weeks.

## Current State Analysis

### Codebase Metrics
- **Total Lines**: 7,961
- **Total Files**: 23
- **Current Test Coverage**: 0%
- **Target Coverage**: 60% (4,777 lines)
- **Lines to Cover**: ~4,800 lines

### File Size Distribution

#### Large Files (Priority 1)
| File | Lines | Priority | Reason |
|------|-------|----------|--------|
| `src/tools/file-tools.ts` | 1,081 | HIGH | Core functionality, most used |
| `src/utils/vault-utils.ts` | 949 | HIGH | Critical vault operations |
| `src/utils/search-utils.ts` | 520 | HIGH | Search is core feature |
| `src/utils/memory-optimizer.ts` | 480 | HIGH | Has security vulnerability |
| `src/utils/graph-utils.ts` | 418 | MEDIUM | Complex graph logic |

#### Medium Files (Priority 2)
| File | Lines | Priority | Reason |
|------|-------|----------|--------|
| `src/utils/file-pool.ts` | 373 | MEDIUM | Performance critical |
| `src/tools/search-tools.ts` | 324 | MEDIUM | User-facing tools |
| `src/tools/vault-tools.ts` | 318 | MEDIUM | Vault operations |
| `src/tools/graph-tools.ts` | 316 | LOW | Less critical |
| `src/tools/metadata-tools.ts` | 312 | LOW | Metadata handling |

## Test Infrastructure Setup (Week 1, Days 1-2)

### Day 1: Framework Installation

```bash
# Install testing dependencies
npm install --save-dev \
  jest@^29.7.0 \
  @types/jest@^29.5.0 \
  ts-jest@^29.1.0 \
  @jest/globals@^29.7.0 \
  jest-extended@^4.0.0

# Install testing utilities
npm install --save-dev \
  @testing-library/jest-dom@^6.1.0 \
  jest-mock-extended@^3.0.0 \
  memfs@^4.6.0 \
  supertest@^6.3.0

# Install coverage tools
npm install --save-dev \
  @bcoe/v8-coverage@^0.2.3 \
  jest-html-reporters@^3.1.0
```

### Day 2: Configuration Setup

#### jest.config.js
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/types/**'
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  },
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@tools/(.*)$': '<rootDir>/src/tools/$1'
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }]
  }
};
```

#### package.json scripts
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:coverage:html": "jest --coverage --coverageReporters=html",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration",
    "test:debug": "node --inspect-brk ./node_modules/.bin/jest --runInBand"
  }
}
```

## Testing Strategy

### Test Types Distribution
- **Unit Tests**: 70% (Focus on isolated functions/classes)
- **Integration Tests**: 25% (Test component interactions)
- **E2E Tests**: 5% (Critical user paths)

### Coverage Goals by Week

| Week | Target | Lines to Cover | Focus Area |
|------|--------|----------------|------------|
| Week 1 | 15% | 1,194 lines | Setup + Critical utils |
| Week 2 | 30% | 2,388 lines | Core file operations |
| Week 3 | 45% | 3,582 lines | Search & metadata |
| Week 4 | 60% | 4,777 lines | Tools & integration |

## Week 1: Foundation (15% Coverage)

### Days 1-2: Infrastructure Setup
- Install and configure Jest
- Create test directory structure
- Set up test utilities and mocks

### Days 3-5: Critical Utilities Testing
```typescript
// Priority files to test:
// 1. src/lru-cache.ts (150 lines)
// 2. src/utils/obsidian-parser.ts (250 lines)
// 3. src/utils/link-parser.ts (200 lines)
// 4. src/types/errors.ts (100 lines)
// 5. src/config/configuration-manager.ts (228 lines)
```

#### Test Files to Create:
- `tests/unit/lru-cache.test.ts`
- `tests/unit/utils/obsidian-parser.test.ts`
- `tests/unit/utils/link-parser.test.ts`
- `tests/unit/types/errors.test.ts`
- `tests/unit/config/configuration-manager.test.ts`

### Sample Test Structure
```typescript
// tests/unit/lru-cache.test.ts
import { LRUCache } from '@/lru-cache';

describe('LRUCache', () => {
  let cache: LRUCache<string>;

  beforeEach(() => {
    cache = new LRUCache<string>({
      maxSize: 1024,
      maxItems: 10
    });
  });

  describe('set and get', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1', 10);
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for missing keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should evict least recently used items', () => {
      // Test LRU eviction logic
    });
  });

  describe('size management', () => {
    it('should track size correctly', () => {
      cache.set('key1', 'value1', 100);
      expect(cache.getTotalSize()).toBe(100);
    });

    it('should evict items when max size exceeded', () => {
      // Test size-based eviction
    });
  });
});
```

## Week 2: Core File Operations (30% Coverage)

### Days 6-10: File and Vault Utilities
```typescript
// Priority files to test:
// 1. src/utils/file-utils.ts (400 lines) - Partial coverage
// 2. src/utils/vault-utils.ts (949 lines) - Critical paths only
// 3. src/utils/memory-optimizer.ts (480 lines) - Focus on security fix
```

#### Test Files to Create:
- `tests/unit/utils/file-utils.test.ts`
- `tests/unit/utils/vault-utils.test.ts`
- `tests/unit/utils/memory-optimizer.test.ts`
- `tests/integration/file-operations.test.ts`

### Mock Strategy for File System
```typescript
// tests/mocks/fs-mock.ts
import { vol } from 'memfs';
import { jest } from '@jest/globals';

export const createFsMock = () => {
  vol.fromJSON({
    '/vault/note1.md': '# Note 1\nContent',
    '/vault/folder/note2.md': '# Note 2\n[[link]]',
    '/vault/.obsidian/config': '{}'
  });

  return vol;
};

// Usage in tests
jest.mock('fs/promises', () => require('memfs').fs.promises);
```

## Week 3: Search and Metadata (45% Coverage)

### Days 11-15: Search and Graph Utilities
```typescript
// Priority files to test:
// 1. src/utils/search-utils.ts (520 lines)
// 2. src/utils/graph-utils.ts (418 lines)
// 3. src/tools/search-tools.ts (324 lines)
// 4. src/tools/metadata-tools.ts (312 lines)
```

#### Test Files to Create:
- `tests/unit/utils/search-utils.test.ts`
- `tests/unit/utils/graph-utils.test.ts`
- `tests/unit/tools/search-tools.test.ts`
- `tests/unit/tools/metadata-tools.test.ts`
- `tests/integration/search-functionality.test.ts`

### Performance Testing
```typescript
// tests/performance/search-performance.test.ts
describe('Search Performance', () => {
  it('should search 1000 files in under 1 second', async () => {
    const startTime = performance.now();
    // Perform search operation
    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(1000);
  });
});
```

## Week 4: Tools and Integration (60% Coverage)

### Days 16-20: Tool Testing and Integration
```typescript
// Priority files to test:
// 1. src/tools/file-tools.ts (1,081 lines) - Critical paths
// 2. src/tools/vault-tools.ts (318 lines)
// 3. src/tools/graph-tools.ts (316 lines)
// 4. Integration tests for MCP server
```

#### Test Files to Create:
- `tests/unit/tools/file-tools.test.ts`
- `tests/unit/tools/vault-tools.test.ts`
- `tests/unit/tools/graph-tools.test.ts`
- `tests/integration/mcp-server.test.ts`
- `tests/e2e/critical-paths.test.ts`

### MCP Server Integration Testing
```typescript
// tests/integration/mcp-server.test.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createTestServer } from '../helpers/server-helper';

describe('MCP Server Integration', () => {
  let server: Server;

  beforeEach(() => {
    server = createTestServer('/test/vault');
  });

  it('should handle file read requests', async () => {
    const response = await server.handleRequest({
      method: 'tools/call',
      params: {
        name: 'obsidian_read_file',
        arguments: { path: 'test.md' }
      }
    });
    expect(response).toBeDefined();
  });
});
```

## Test Utilities and Helpers

### Common Test Utilities
```typescript
// tests/helpers/test-utils.ts
export const createMockVault = (files: Record<string, string>) => {
  return {
    files,
    getFile: jest.fn((path) => files[path]),
    writeFile: jest.fn(),
    deleteFile: jest.fn()
  };
};

export const createMockCache = () => {
  const cache = new Map();
  return {
    get: jest.fn((key) => cache.get(key)),
    set: jest.fn((key, value) => cache.set(key, value)),
    has: jest.fn((key) => cache.has(key)),
    clear: jest.fn(() => cache.clear())
  };
};

export const waitForAsync = (ms: number = 0) =>
  new Promise(resolve => setTimeout(resolve, ms));
```

## Continuous Integration Setup

### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Test Coverage

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run tests with coverage
      run: npm run test:coverage

    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
        flags: unittests
        fail_ci_if_error: true

    - name: Check coverage thresholds
      run: |
        coverage=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
        if (( $(echo "$coverage < 60" | bc -l) )); then
          echo "Coverage is below 60%: $coverage%"
          exit 1
        fi
```

## Monitoring Progress

### Daily Metrics
```bash
# Run daily to track progress
npm run test:coverage -- --json --outputFile=coverage-report.json

# Parse and display progress
node scripts/coverage-progress.js
```

### Weekly Milestones

| Week | Milestone | Success Criteria |
|------|-----------|------------------|
| 1 | Foundation | Jest configured, 15% coverage |
| 2 | Core Tests | File operations tested, 30% coverage |
| 3 | Feature Tests | Search/metadata tested, 45% coverage |
| 4 | Complete | All tools tested, 60% coverage |

## Critical Test Cases

### Security-Focused Tests
```typescript
// Must test the security vulnerabilities identified
describe('Security Fixes', () => {
  it('should use safe buffer allocation', () => {
    // Test Buffer.alloc instead of allocUnsafe
  });

  it('should validate environment variables', () => {
    // Test env var validation
  });

  it('should not use dynamic require', () => {
    // Ensure static imports only
  });
});
```

### Performance-Critical Tests
```typescript
describe('Performance', () => {
  it('should stream large files', () => {
    // Test streaming for files > 1MB
  });

  it('should limit concurrent operations', () => {
    // Test concurrency limits
  });

  it('should bound memory usage', () => {
    // Test memory limits
  });
});
```

## Resource Requirements

### Team Allocation
- **1 Developer**: Full-time for 4 weeks
- **Code Review**: 2 hours/week from senior developer

### Tools and Services
- Jest + TypeScript setup
- Coverage reporting (Codecov/Coveralls)
- CI/CD pipeline (GitHub Actions)
- Performance monitoring

## Risk Mitigation

### Potential Blockers
1. **Complex Mocking Requirements**
   - Solution: Use memfs for file system mocking
   - Fallback: Create abstraction layer

2. **Tight Coupling in Code**
   - Solution: Refactor minimally during testing
   - Fallback: Use integration tests instead

3. **Time Constraints**
   - Solution: Focus on critical paths first
   - Fallback: Extend timeline, accept 50% initially

## Success Metrics

### Quantitative
- 60% line coverage achieved
- 60% branch coverage achieved
- All critical paths tested
- Zero failing tests in CI

### Qualitative
- Improved code confidence
- Faster development cycles
- Reduced production bugs
- Better documentation through tests

## Next Steps After 60%

### Path to 80% Coverage (Weeks 5-6)
- Add E2E tests for all user workflows
- Test edge cases and error scenarios
- Add mutation testing
- Performance regression tests

### Maintenance Strategy
- Require tests for all new features
- Maintain 60% minimum in CI
- Weekly coverage reviews
- Quarterly test refactoring

## Conclusion

This plan provides a structured approach to achieve 60% test coverage in 4 weeks, focusing on critical functionality first and building a sustainable testing culture. The investment in testing infrastructure will pay dividends in code quality, developer confidence, and reduced production issues.

### Week 1 Action Items
1. Install Jest and dependencies
2. Configure test infrastructure
3. Create first 5 test files
4. Achieve 15% coverage
5. Set up CI pipeline

Start Date: [TO BE DETERMINED]
End Date: [START DATE + 4 WEEKS]