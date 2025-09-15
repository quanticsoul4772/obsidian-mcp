# Refactoring Example

## Clean Architecture Refactoring Pattern

This document shows how to refactor the codebase using clean architecture principles while maintaining backward compatibility.

## Key Refactoring Patterns

### 1. Dependency Injection Pattern

**Before** (Tight Coupling):
```typescript
// src/index.ts
const fileCache = new LRUCache<string>({...});
const fileUtils = new FileUtils(vaultPath, fileCache);
const parser = new ObsidianParser();
const linkParser = new LinkParser(fileUtils, parser);
```

**After** (Dependency Injection):
```typescript
// src/container/simple-container.ts
export class SimpleContainer {
  private services: Map<string, any> = new Map();

  register<T>(name: string, factory: () => T): void {
    this.services.set(name, factory());
  }

  get<T>(name: string): T {
    return this.services.get(name);
  }
}

// Usage
const container = new SimpleContainer();
container.register('fileUtils', () => new FileUtils(vaultPath, cache));
container.register('parser', () => new ObsidianParser());
container.register('linkParser', () =>
  new LinkParser(container.get('fileUtils'), container.get('parser'))
);
```

### 2. Repository Pattern

**Before** (Direct File Access):
```typescript
// Scattered throughout codebase
const content = await fs.readFile(path, 'utf-8');
const parsed = matter(content);
const tags = extractTags(content);
```

**After** (Repository Abstraction):
```typescript
export class NoteRepository {
  async getNote(id: string): Promise<Note> {
    const content = await this.fileService.readFile(id);
    const metadata = this.parser.parse(content);
    return new Note(id, content, metadata);
  }

  async saveNote(note: Note): Promise<void> {
    const content = this.formatter.format(note);
    await this.fileService.writeFile(note.id, content);
  }

  async findByTag(tag: string): Promise<Note[]> {
    // Centralized query logic
  }
}
```

### 3. Factory Pattern

**Before** (Direct Instantiation):
```typescript
registerFileTools(server, fileUtils, parser);
registerSearchTools(server, searchUtils);
registerMetadataTools(server, metadataUtils);
```

**After** (Factory Pattern):
```typescript
export class ToolFactory {
  static createTools(type: ToolType): ITool[] {
    switch(type) {
      case ToolType.File:
        return [new ReadTool(), new WriteTool(), new DeleteTool()];
      case ToolType.Search:
        return [new TextSearchTool(), new TagSearchTool()];
      default:
        throw new Error(`Unknown tool type: ${type}`);
    }
  }
}

// Usage
const tools = ToolFactory.createTools(ToolType.File);
tools.forEach(tool => server.register(tool));
```

### 4. Adapter Pattern

**Before** (Direct Cache Usage):
```typescript
const cached = fileCache.get(key);
if (cached) return cached;
const result = await loadFile(key);
fileCache.set(key, result, size);
```

**After** (Cache Adapter):
```typescript
interface ICache<T> {
  get(key: string): Promise<T | undefined>;
  set(key: string, value: T): Promise<void>;
  has(key: string): Promise<boolean>;
}

export class LRUCacheAdapter<T> implements ICache<T> {
  constructor(private cache: LRUCache<T>) {}

  async get(key: string): Promise<T | undefined> {
    return this.cache.get(key);
  }

  async set(key: string, value: T): Promise<void> {
    this.cache.set(key, value, 0);
  }

  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }
}
```

### 5. Strategy Pattern

**Before** (Conditional Logic):
```typescript
async function search(type: string, query: any) {
  if (type === 'text') {
    // text search logic
  } else if (type === 'tag') {
    // tag search logic
  } else if (type === 'link') {
    // link search logic
  }
}
```

**After** (Strategy Pattern):
```typescript
interface ISearchStrategy {
  search(query: any): Promise<SearchResult[]>;
}

class TextSearchStrategy implements ISearchStrategy {
  async search(query: any): Promise<SearchResult[]> {
    // text search implementation
  }
}

class TagSearchStrategy implements ISearchStrategy {
  async search(query: any): Promise<SearchResult[]> {
    // tag search implementation
  }
}

class SearchContext {
  private strategy: ISearchStrategy;

  setStrategy(strategy: ISearchStrategy): void {
    this.strategy = strategy;
  }

  async executeSearch(query: any): Promise<SearchResult[]> {
    return this.strategy.search(query);
  }
}
```

### 6. Command Pattern

**Before** (Direct Method Calls):
```typescript
server.tool('read_file', async (params) => {
  const content = await fileUtils.readFile(params.path);
  return { content };
});
```

**After** (Command Pattern):
```typescript
interface ICommand {
  execute(params: any): Promise<any>;
  canExecute(params: any): boolean;
  undo?(): Promise<void>;
}

class ReadFileCommand implements ICommand {
  constructor(private fileService: IFileService) {}

  async execute(params: any): Promise<any> {
    return this.fileService.readFile(params.path);
  }

  canExecute(params: any): boolean {
    return !!params.path;
  }
}

class CommandHandler {
  private commands: Map<string, ICommand> = new Map();

  register(name: string, command: ICommand): void {
    this.commands.set(name, command);
  }

  async execute(name: string, params: any): Promise<any> {
    const command = this.commands.get(name);
    if (!command) throw new Error(`Unknown command: ${name}`);
    if (!command.canExecute(params)) throw new Error('Invalid parameters');
    return command.execute(params);
  }
}
```

## Implementation Guide

### Step 1: Create Interfaces
Start by defining interfaces for your core services without changing implementations:

```typescript
// Keep existing classes, just add interfaces
export interface IFileService {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
}

// Existing class now implements interface
export class FileUtils implements IFileService {
  // Existing implementation unchanged
}
```

### Step 2: Introduce Container Gradually
Create a simple container that can work alongside existing code:

```typescript
// New container
const container = new SimpleContainer();

// Register existing instances
container.register('fileUtils', fileUtils);
container.register('parser', parser);

// Gradually migrate to using container
const fileService = container.get<IFileService>('fileUtils');
```

### Step 3: Extract Business Logic
Move business logic from tools to services:

```typescript
// Before: Logic in tool registration
server.tool('complex_operation', async (params) => {
  // 50 lines of business logic
});

// After: Logic in service
class BusinessService {
  async performComplexOperation(params: any): Promise<any> {
    // Business logic here
  }
}

server.tool('complex_operation', async (params) => {
  return container.get<BusinessService>('businessService')
    .performComplexOperation(params);
});
```

### Step 4: Add Tests
With interfaces and DI, testing becomes easier:

```typescript
describe('BusinessService', () => {
  let service: BusinessService;
  let mockFileService: jest.Mocked<IFileService>;

  beforeEach(() => {
    mockFileService = createMock<IFileService>();
    service = new BusinessService(mockFileService);
  });

  it('should perform operation', async () => {
    mockFileService.readFile.mockResolvedValue('content');
    const result = await service.performComplexOperation({});
    expect(result).toBeDefined();
  });
});
```

## Benefits

1. **Testability**: Mock dependencies easily
2. **Maintainability**: Clear separation of concerns
3. **Flexibility**: Swap implementations without changing code
4. **Scalability**: Add new features without modifying existing code
5. **Documentation**: Interfaces serve as contracts

## Migration Strategy

1. **Phase 1**: Add interfaces to existing classes (no breaking changes)
2. **Phase 2**: Introduce dependency injection container
3. **Phase 3**: Extract business logic to services
4. **Phase 4**: Add repository layer for data access
5. **Phase 5**: Implement remaining patterns as needed

## Conclusion

These refactoring patterns can be applied incrementally without breaking existing functionality. Start with the patterns that provide the most immediate value for your use case.