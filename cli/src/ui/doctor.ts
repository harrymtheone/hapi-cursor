/**
 * Doctor command implementation
 *
 * Provides comprehensive diagnostics and troubleshooting information
 * for hapi CLI including configuration, runner status, logs, and links.
 *
 * Plan 10-03: receives the frozen Config via parameter instead of importing
 * the deleted singleton.
 */

import chalk from 'chalk'
import type { Config } from '@/configuration'
import { readSettings } from '@/persistence'
import { checkIfRunnerRunningAndCleanupStaleState } from '@/runner/controlClient'
import { findRunawayHappyProcesses, findAllHappyProcesses } from '@/runner/doctor'
import { readRunnerState } from '@/persistence'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { isBunCompiled, projectPath, runtimePath } from '@/projectPath'
import { getInvokedCwd } from '@/utils/invokedCwd'
import packageJson from '../../package.json'

type DoctorConfig = Pick<
    Config,
    'apiUrl' | 'happyHomeDir' | 'logsDir' | 'settingsFile' | 'runnerStateFile' | 'runnerLockFile'
>

/**
 * Get relevant environment information for debugging
 */
export function getEnvironmentInfo(config?: Pick<Config, 'apiUrl' | 'happyHomeDir' | 'logsDir'>): Record<string, any> {
    return {
        PWD: process.env.PWD,
        HAPI_HOME: process.env.HAPI_HOME,
        HAPI_API_URL: process.env.HAPI_API_URL,
        HAPI_PROJECT_ROOT: process.env.HAPI_PROJECT_ROOT,
        CLI_API_TOKEN_SET: Boolean(process.env.CLI_API_TOKEN),
        NODE_ENV: process.env.NODE_ENV,
        DEBUG: process.env.DEBUG,
        workingDirectory: getInvokedCwd(),
        processArgv: process.argv,
        happyDir: config?.happyHomeDir,
        apiUrl: config?.apiUrl,
        logsDir: config?.logsDir,
        processPid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        user: process.env.USER,
        home: process.env.HOME,
        shell: process.env.SHELL,
        terminal: process.env.TERM,
    };
}

function getLogFiles(logDir: string): { file: string, path: string, modified: Date }[] {
    if (!existsSync(logDir)) {
        return [];
    }

    try {
        return readdirSync(logDir)
            .filter(file => file.endsWith('.log'))
            .map(file => {
                const path = join(logDir, file);
                const stats = statSync(path);
                return { file, path, modified: stats.mtime };
            })
            .sort((a, b) => b.modified.getTime() - a.modified.getTime());
    } catch {
        return [];
    }
}

/**
 * Run doctor command specifically for runner diagnostics
 */
export async function runDoctorRunner(config: DoctorConfig): Promise<void> {
    return runDoctorCommand(config, 'runner');
}

export async function runDoctorCommand(config: DoctorConfig, filter?: 'all' | 'runner'): Promise<void> {
    if (!filter) {
        filter = 'all';
    }

    console.log(chalk.bold.cyan('\n🩺 hapi CLI Doctor\n'));

    if (filter === 'all') {
        console.log(chalk.bold('📋 Basic Information'));
        console.log(`hapi CLI Version: ${chalk.green(packageJson.version)}`);
        console.log(`Platform: ${chalk.green(process.platform)} ${process.arch}`);
        console.log(`Node.js Version: ${chalk.green(process.version)}`);
        console.log('');

        console.log(chalk.bold('🔧 Runner Spawn Diagnostics'));
        const projectRoot = projectPath();
        const cliEntrypoint = join(projectRoot, 'src', 'index.ts');

        if (isBunCompiled()) {
            console.log(`Executable: ${chalk.blue(process.execPath)}`);
            console.log(`Runtime Assets: ${chalk.blue(runtimePath(config.happyHomeDir))}`);
        } else {
            console.log(`Project Root: ${chalk.blue(projectRoot)}`);
            console.log(`CLI Entrypoint: ${chalk.blue(cliEntrypoint)}`);
            console.log(`CLI Exists: ${existsSync(cliEntrypoint) ? chalk.green('✓ Yes') : chalk.red('❌ No')}`);
        }
        console.log('');

        console.log(chalk.bold('⚙️  Configuration'));
        console.log(`hapi Home: ${chalk.blue(config.happyHomeDir)}`);
        console.log(`Bot URL: ${chalk.blue(config.apiUrl)}`);
        console.log(`Logs Dir: ${chalk.blue(config.logsDir)}`);

        console.log(chalk.bold('\n🌍 Environment Variables'));
        const env = getEnvironmentInfo(config);
        console.log(`HAPI_HOME: ${env.HAPI_HOME ? chalk.green(env.HAPI_HOME) : chalk.gray('not set')}`);
        console.log(`HAPI_API_URL: ${env.HAPI_API_URL ? chalk.green(env.HAPI_API_URL) : chalk.gray('not set')}`);
        console.log(`CLI_API_TOKEN: ${env.CLI_API_TOKEN_SET ? chalk.green('set') : chalk.gray('not set')}`);
        console.log(`DEBUG: ${env.DEBUG ? chalk.green(env.DEBUG) : chalk.gray('not set')}`);
        console.log(`NODE_ENV: ${env.NODE_ENV ? chalk.green(env.NODE_ENV) : chalk.gray('not set')}`);

        let settings;
        try {
            settings = await readSettings(config.settingsFile);
            console.log(chalk.bold('\n📄 Settings (settings.json):'));
            const displaySettings = { ...settings, cliApiToken: settings.cliApiToken ? '***' : undefined };
            console.log(chalk.gray(JSON.stringify(displaySettings, null, 2)));
        } catch (error) {
            console.log(chalk.bold('\n📄 Settings:'));
            console.log(chalk.red('❌ Failed to read settings'));
            settings = {};
        }

        console.log(chalk.bold('\n🔐 Direct Connect Auth'));
        const envToken = process.env.CLI_API_TOKEN;
        const settingsToken = settings.cliApiToken;
        const hasToken = Boolean(envToken || settingsToken);
        const tokenSource = envToken ? 'environment variable' : (settingsToken ? 'settings file' : 'none');
        if (hasToken) {
            console.log(chalk.green(`✓ CLI_API_TOKEN is set (from ${tokenSource})`));
        } else {
            console.log(chalk.red('❌ CLI_API_TOKEN is not set'));
            console.log(chalk.gray('  Run `hapi auth login` to configure or set CLI_API_TOKEN env var'));
        }
    }

    console.log(chalk.bold('\n🤖 Runner Status'));
    try {
        const isRunning = await checkIfRunnerRunningAndCleanupStaleState(config);
        const state = await readRunnerState(config.runnerStateFile);

        if (isRunning && state) {
            console.log(chalk.green('✓ Runner is running'));
            console.log(`  PID: ${state.pid}`);
            console.log(`  Started: ${new Date(state.startTime).toLocaleString()}`);
            console.log(`  CLI Version: ${state.startedWithCliVersion}`);
            if (state.httpPort) {
                console.log(`  HTTP Port: ${state.httpPort}`);
            }
        } else if (state && !isRunning) {
            console.log(chalk.yellow('⚠️  Runner state exists but process not running (stale)'));
        } else {
            console.log(chalk.red('❌ Runner is not running'));
        }

        if (state) {
            console.log(chalk.bold('\n📄 Runner State:'));
            console.log(chalk.blue(`Location: ${config.runnerStateFile}`));
            console.log(chalk.gray(JSON.stringify(state, null, 2)));
        }

        const allProcesses = await findAllHappyProcesses();
        if (allProcesses.length > 0) {
            console.log(chalk.bold('\n🔍 All hapi CLI Processes'));

            const grouped = allProcesses.reduce((groups, process) => {
                if (!groups[process.type]) groups[process.type] = [];
                groups[process.type].push(process);
                return groups;
            }, {} as Record<string, typeof allProcesses>);

            Object.entries(grouped).forEach(([type, processes]) => {
                const typeLabels: Record<string, string> = {
                    'current': '📍 Current Process',
                    'runner': '🤖 Runner',
                    'runner-version-check': '🔍 Runner Version Check (stuck)',
                    'runner-spawned-session': '🔗 Runner-Spawned Sessions',
                    'user-session': '👤 User Sessions',
                    'dev-runner': '🛠️  Dev Runner',
                    'dev-runner-version-check': '🛠️  Dev Runner Version Check (stuck)',
                    'dev-session': '🛠️  Dev Sessions',
                    'dev-doctor': '🛠️  Dev Doctor',
                    'dev-related': '🛠️  Dev Related',
                    'doctor': '🩺 Doctor',
                    'unknown': '❓ Unknown'
                };

                console.log(chalk.blue(`\n${typeLabels[type] || type}:`));
                processes.forEach(({ pid, command }) => {
                    const color = type === 'current' ? chalk.green :
                        type.startsWith('dev') ? chalk.cyan :
                            type.includes('runner') ? chalk.blue : chalk.gray;
                    console.log(`  ${color(`PID ${pid}`)}: ${chalk.gray(command)}`);
                });
            });
        } else {
            console.log(chalk.red('❌ No hapi processes found'));
        }

        if (filter === 'all' && allProcesses.length > 1) {
            console.log(chalk.bold('\n💡 Process Management'));
            console.log(chalk.gray('To clean up runaway processes: hapi doctor clean'));
        }
    } catch (error) {
        console.log(chalk.red('❌ Error checking runner status'));
    }

    if (filter === 'all') {
        console.log(chalk.bold('\n📝 Log Files'));

        const allLogs = getLogFiles(config.logsDir);

        if (allLogs.length > 0) {
            const runnerLogs = allLogs.filter(({ file }) => file.includes('runner'));
            const regularLogs = allLogs.filter(({ file }) => !file.includes('runner'));

            if (regularLogs.length > 0) {
                console.log(chalk.blue('\nRecent Logs:'));
                const logsToShow = regularLogs.slice(0, 10);
                logsToShow.forEach(({ file, path, modified }) => {
                    console.log(`  ${chalk.green(file)} - ${modified.toLocaleString()}`);
                    console.log(chalk.gray(`    ${path}`));
                });
                if (regularLogs.length > 10) {
                    console.log(chalk.gray(`  ... and ${regularLogs.length - 10} more log files`));
                }
            }

            if (runnerLogs.length > 0) {
                console.log(chalk.blue('\nRunner Logs:'));
                const runnerLogsToShow = runnerLogs.slice(0, 5);
                runnerLogsToShow.forEach(({ file, path, modified }) => {
                    console.log(`  ${chalk.green(file)} - ${modified.toLocaleString()}`);
                    console.log(chalk.gray(`    ${path}`));
                });
                if (runnerLogs.length > 5) {
                    console.log(chalk.gray(`  ... and ${runnerLogs.length - 5} more runner log files`));
                }
            } else {
                console.log(chalk.yellow('\nNo runner log files found'));
            }
        } else {
            console.log(chalk.yellow('No log files found'));
        }

        console.log(chalk.bold('\n🐛 Support & Bug Reports'));
        const pkg = packageJson as unknown as { bugs?: string | { url?: string }; homepage?: string }
        const bugsUrl = typeof pkg.bugs === 'string' ? pkg.bugs : pkg.bugs?.url
        if (bugsUrl) {
            console.log(`Report issues: ${chalk.blue(bugsUrl)}`);
        }
        console.log(`Documentation: ${chalk.blue(pkg.homepage ?? 'See project README')}`);
    }

    console.log(chalk.green('\n✅ Doctor diagnosis complete!\n'));
}
