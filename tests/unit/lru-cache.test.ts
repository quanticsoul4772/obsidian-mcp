import { LRUCache } from '../../src/lru-cache';

describe('LRUCache', () => {
  describe('basic operations', () => {
    it('should store and retrieve values', () => {
      const cache = new LRUCache<string>({
        maxSize: 1024 * 1024,
        maxItems: 100
      });

      cache.set('key1', 'value1', 10);
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      const cache = new LRUCache<string>({
        maxSize: 1024,
        maxItems: 100
      });

      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should check if key exists', () => {
      const cache = new LRUCache<string>({
        maxSize: 1024,
        maxItems: 100
      });

      cache.set('key1', 'value1', 10);
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    it('should delete keys', () => {
      const cache = new LRUCache<string>({
        maxSize: 1024,
        maxItems: 100
      });

      cache.set('key1', 'value1', 10);
      expect(cache.has('key1')).toBe(true);

      cache.delete('key1');
      expect(cache.has('key1')).toBe(false);
    });

    it('should clear all entries', () => {
      const cache = new LRUCache<string>({
        maxSize: 1024,
        maxItems: 100
      });

      cache.set('key1', 'value1', 10);
      cache.set('key2', 'value2', 10);

      cache.clear();

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
    });
  });

  describe('size management', () => {
    it('should track current size', () => {
      const cache = new LRUCache<string>({
        maxSize: 1024,
        maxItems: 100
      });

      const stats1 = cache.getStats();
      expect(stats1.totalSize).toBe(0);

      cache.set('key1', 'value1', 100);
      const stats2 = cache.getStats();
      expect(stats2.totalSize).toBe(100);

      cache.set('key2', 'value2', 200);
      const stats3 = cache.getStats();
      expect(stats3.totalSize).toBe(300);
    });

    it('should evict LRU items when size exceeds max', () => {
      const cache = new LRUCache<string>({
        maxSize: 300,
        maxItems: 10
      });

      cache.set('key1', 'value1', 100);
      cache.set('key2', 'value2', 100);
      cache.set('key3', 'value3', 100);

      // This should evict key1
      cache.set('key4', 'value4', 100);

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });

    it('should update LRU order on get', () => {
      const cache = new LRUCache<string>({
        maxSize: 300,
        maxItems: 10
      });

      cache.set('key1', 'value1', 100);
      cache.set('key2', 'value2', 100);
      cache.set('key3', 'value3', 100);

      // Access key1 to make it most recently used
      cache.get('key1');

      // This should evict key2 (least recently used)
      cache.set('key4', 'value4', 100);

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });

    it('should handle updating existing key with new size', () => {
      const cache = new LRUCache<string>({
        maxSize: 500,
        maxItems: 10
      });

      cache.set('key1', 'value1', 100);
      const stats1 = cache.getStats();
      expect(stats1.totalSize).toBe(100);

      cache.set('key1', 'longer value', 200);
      const stats2 = cache.getStats();
      expect(stats2.totalSize).toBe(200);
    });
  });

  describe('TTL expiration', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should expire entries after TTL', () => {
      const cache = new LRUCache<string>({
        maxSize: 1024,
        maxItems: 100,
        ttl: 1000
      });

      cache.set('key1', 'value1', 10);
      expect(cache.get('key1')).toBe('value1');

      jest.advanceTimersByTime(1001);

      expect(cache.get('key1')).toBeUndefined();
    });

    it('should not expire entries before TTL', () => {
      const cache = new LRUCache<string>({
        maxSize: 1024,
        maxItems: 100,
        ttl: 1000
      });

      cache.set('key1', 'value1', 10);

      jest.advanceTimersByTime(999);

      expect(cache.get('key1')).toBe('value1');
    });

    it('should handle no TTL (never expire)', () => {
      const cache = new LRUCache<string>({
        maxSize: 1024,
        maxItems: 100
      });

      cache.set('key1', 'value1', 10);

      jest.advanceTimersByTime(1000000);

      expect(cache.get('key1')).toBe('value1');
    });
  });

  describe('statistics', () => {
    it('should track hits and misses', () => {
      const cache = new LRUCache<string>({
        maxSize: 1024,
        maxItems: 100
      });

      cache.set('key1', 'value1', 10);

      cache.get('key1'); // hit
      cache.get('key2'); // miss
      cache.get('key1'); // hit

      const stats = cache.getStats();
      expect(stats.hitRate).toBeGreaterThan(0);
    });

    it('should track evictions', () => {
      const cache = new LRUCache<string>({
        maxSize: 200,
        maxItems: 10
      });

      cache.set('key1', 'value1', 100);
      cache.set('key2', 'value2', 100);

      // This should evict key1
      cache.set('key3', 'value3', 100);

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key3')).toBe(true);
    });

    it('should calculate correct statistics', () => {
      const cache = new LRUCache<string>({
        maxSize: 1024,
        maxItems: 100
      });

      cache.set('key1', 'value1', 100);
      cache.set('key2', 'value2', 200);

      const stats = cache.getStats();
      expect(stats.itemCount).toBe(2);
      expect(stats.totalSize).toBe(300);
      expect(stats.maxSize).toBe(1024);
    });
  });

  describe('edge cases', () => {
    it('should handle zero max size', () => {
      const cache = new LRUCache<string>({
        maxSize: 0,
        maxItems: 100
      });

      cache.set('key1', 'value1', 10);
      expect(cache.has('key1')).toBe(false);
    });

    it('should handle negative sizes gracefully', () => {
      const cache = new LRUCache<string>({
        maxSize: 1024,
        maxItems: 100
      });

      // Negative size should be treated as 0
      cache.set('key1', 'value1', -10);
      const stats = cache.getStats();
      expect(stats.totalSize).toBe(0);
    });

    it('should handle very large items', () => {
      const cache = new LRUCache<string>({
        maxSize: 100,
        maxItems: 10
      });

      // Item larger than cache
      cache.set('key1', 'value1', 200);
      expect(cache.has('key1')).toBe(false);
    });

    it('should handle many small items', () => {
      const cache = new LRUCache<string>({
        maxSize: 1000,
        maxItems: 50
      });

      for (let i = 0; i < 100; i++) {
        cache.set(`key${i}`, `value${i}`, 10);
      }

      // Should have evicted first items
      expect(cache.has('key0')).toBe(false);
      expect(cache.has('key99')).toBe(true);
    });
  });
});