/**
 * Application bootstrapper for initialization and health checks
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { performance } from 'perf_hooks';

export interface HealthCheckResult {
  check: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration?: number;
}

/**
 * Handles application bootstrapping and initialization
 */
export class ApplicationBootstrapper {
  private healthChecks: HealthCheckResult[] = [];

  /**
   * Perform all health checks
   */
  async performHealthChecks(): Promise<void> {
    console.error('Performing health checks...');

    await this.checkNodeVersion();
    await this.checkFileSystem();
    await this.checkMemory();
    await this.checkDependencies();

    this.reportHealthChecks();
  }

  /**
   * Check Node.js version
   */
  private async checkNodeVersion(): Promise<void> {
    const start = performance.now();
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

    if (majorVersion < 18) {
      this.healthChecks.push({
        check: 'Node.js Version',
        status: 'fail',
        message: `Node.js 18+ required, found ${nodeVersion}`,
        duration: performance.now() - start
      });
    } else {
      this.healthChecks.push({
        check: 'Node.js Version',
        status: 'pass',
        message: `Running on Node.js ${nodeVersion}`,
        duration: performance.now() - start
      });
    }
  }

  /**
   * Check file system access
   */
  private async checkFileSystem(): Promise<void> {
    const start = performance.now();
    const tempFile = path.join(process.cwd(), '.obsidian-mcp-test');

    try {
      // Test write access
      await fs.writeFile(tempFile, 'test');
      await fs.unlink(tempFile);

      this.healthChecks.push({
        check: 'File System',
        status: 'pass',
        message: 'Read/write access verified',
        duration: performance.now() - start
      });
    } catch (error) {
      this.healthChecks.push({
        check: 'File System',
        status: 'fail',
        message: `File system access error: ${error}`,
        duration: performance.now() - start
      });
    }
  }

  /**
   * Check available memory
   */
  private async checkMemory(): Promise<void> {
    const start = performance.now();
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(usage.rss / 1024 / 1024);

    if (rssMB > 500) {
      this.healthChecks.push({
        check: 'Memory',
        status: 'warn',
        message: `High memory usage: ${rssMB}MB RSS, ${heapUsedMB}MB/${heapTotalMB}MB heap`,
        duration: performance.now() - start
      });
    } else {
      this.healthChecks.push({
        check: 'Memory',
        status: 'pass',
        message: `Memory usage: ${rssMB}MB RSS, ${heapUsedMB}MB/${heapTotalMB}MB heap`,
        duration: performance.now() - start
      });
    }
  }

  /**
   * Check required dependencies
   */
  private async checkDependencies(): Promise<void> {
    const start = performance.now();
    const requiredModules = [
      '@modelcontextprotocol/sdk',
      'glob',
      'gray-matter',
      'js-yaml',
      'fuse.js',
      'zod'
    ];

    const missing: string[] = [];

    for (const module of requiredModules) {
      try {
        await import(module);
      } catch {
        missing.push(module);
      }
    }

    if (missing.length > 0) {
      this.healthChecks.push({
        check: 'Dependencies',
        status: 'fail',
        message: `Missing dependencies: ${missing.join(', ')}`,
        duration: performance.now() - start
      });
    } else {
      this.healthChecks.push({
        check: 'Dependencies',
        status: 'pass',
        message: 'All required dependencies found',
        duration: performance.now() - start
      });
    }
  }

  /**
   * Report health check results
   */
  private reportHealthChecks(): void {
    console.error('\n=== Health Check Results ===\n');

    for (const check of this.healthChecks) {
      const status = this.getStatusIcon(check.status);
      const duration = check.duration ? ` (${check.duration.toFixed(2)}ms)` : '';
      console.error(`${status} ${check.check}: ${check.message}${duration}`);
    }

    const failed = this.healthChecks.filter(c => c.status === 'fail');
    const warnings = this.healthChecks.filter(c => c.status === 'warn');

    if (failed.length > 0) {
      console.error(`\n❌ ${failed.length} checks failed`);
      throw new Error('Health checks failed');
    }

    if (warnings.length > 0) {
      console.error(`\n⚠️  ${warnings.length} warnings`);
    } else {
      console.error('\n✅ All checks passed');
    }

    console.error('\n===========================\n');
  }

  /**
   * Get status icon
   */
  private getStatusIcon(status: 'pass' | 'fail' | 'warn'): string {
    switch (status) {
      case 'pass':
        return '✅';
      case 'fail':
        return '❌';
      case 'warn':
        return '⚠️';
    }
  }

  /**
   * Initialize application resources
   */
  async initializeResources(): Promise<void> {
    // Pre-warm caches
    await this.warmCaches();

    // Initialize monitoring if enabled
    if (process.env.PERF_MONITORING === 'true') {
      await this.initializeMonitoring();
    }
  }

  /**
   * Warm up caches
   */
  private async warmCaches(): Promise<void> {
    console.error('Warming up caches...');
    // Cache warming logic would go here
  }

  /**
   * Initialize performance monitoring
   */
  private async initializeMonitoring(): Promise<void> {
    console.error('Initializing performance monitoring...');
    // Import and initialize performance monitor (globalMonitor auto-initializes on import)
    await import('../utils/performance-monitor.js');
    console.error('Performance monitoring enabled');
  }
}