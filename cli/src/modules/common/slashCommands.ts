import { access, readdir, readFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { homedir } from 'os';
import { parse as parseYaml } from 'yaml';
import { getCapability } from '@hapi/protocol';

export interface SlashCommand {
    name: string;
    description?: string;
    source: 'user' | 'project';
    content?: string;
}

export interface ListSlashCommandsRequest {
    agent: string;
}

export interface ListSlashCommandsResponse {
    success: boolean;
    commands?: SlashCommand[];
    error?: string;
}

/**
 * Parse frontmatter from a markdown file content.
 * Returns the description (from frontmatter) and the body content.
 */
function parseFrontmatter(fileContent: string): { description?: string; content: string } {
    const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (match) {
        const yamlContent = match[1];
        const body = match[2].trim();
        try {
            const parsed = parseYaml(yamlContent) as Record<string, unknown> | null;
            const description = typeof parsed?.description === 'string' ? parsed.description : undefined;
            return { description, content: body };
        } catch {
            return { content: fileContent.trim() };
        }
    }
    return { content: fileContent.trim() };
}

/**
 * Resolve the user-level slash-command directory for an agent via the
 * capability table. Returns `null` when the agent has no user-level path
 * (the v1 Cursor configuration; CURS-02 will wire a real directory later).
 */
function getUserCommandsDir(agent: string): string | null {
    const resolver = getCapability(agent, 'userSlashCommandsDir');
    return resolver ? resolver(homedir()) : null;
}

/**
 * Resolve the project-level slash-command directory for an agent via the
 * capability table. Returns `null` when the agent has no project-level path.
 */
function getProjectCommandsDir(agent: string, projectDir: string): string | null {
    const resolver = getCapability(agent, 'projectSlashCommandsDir');
    return resolver ? resolver(projectDir) : null;
}

async function pathExists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

async function listProjectCommandDirs(agent: string, projectDir?: string): Promise<string[]> {
    if (!projectDir) {
        return [];
    }

    const resolvedProjectDir = resolve(projectDir);
    const directories = [resolvedProjectDir];
    let currentDirectory = resolvedProjectDir;

    while (true) {
        if (await pathExists(join(currentDirectory, '.git'))) {
            return [...directories]
                .reverse()
                .map((directory) => getProjectCommandsDir(agent, directory))
                .filter((directory): directory is string => directory !== null);
        }

        const parentDirectory = dirname(currentDirectory);
        if (parentDirectory === currentDirectory) {
            const dir = getProjectCommandsDir(agent, resolvedProjectDir);
            return dir ? [dir] : [];
        }

        currentDirectory = parentDirectory;
        directories.push(currentDirectory);
    }
}

/**
 * Scan a directory for commands (*.md files).
 * Returns commands with parsed frontmatter.
 */
async function scanCommandsDir(
    dir: string,
    source: 'user' | 'project'
): Promise<SlashCommand[]> {
    async function scanRecursive(currentDir: string, segments: string[]): Promise<SlashCommand[]> {
        const entries = await readdir(currentDir, { withFileTypes: true }).catch(() => null);
        if (!entries) {
            return [];
        }

        const commandsByEntry = await Promise.all(
            entries.map(async (entry): Promise<SlashCommand[]> => {
                if (entry.name.startsWith('.') || entry.isSymbolicLink()) {
                    return [];
                }

                if (entry.isDirectory()) {
                    if (entry.name.includes(':')) return [];
                    return scanRecursive(join(currentDir, entry.name), [...segments, entry.name]);
                }

                if (!entry.isFile() || !entry.name.endsWith('.md')) {
                    return [];
                }

                const baseName = entry.name.slice(0, -3);
                if (!baseName || baseName.includes(':')) {
                    return [];
                }

                const name = [...segments, baseName].join(':');
                const fallbackDescription = 'Custom command';

                try {
                    const filePath = join(currentDir, entry.name);
                    const fileContent = await readFile(filePath, 'utf-8');
                    const parsed = parseFrontmatter(fileContent);

                    return [{
                        name,
                        description: parsed.description ?? fallbackDescription,
                        source,
                        content: parsed.content,
                    }];
                } catch {
                    return [{
                        name,
                        description: fallbackDescription,
                        source,
                    }];
                }
            })
        );

        return commandsByEntry.flat();
    }

    const commands = await scanRecursive(dir, []);
    return commands.sort((a, b) => a.name.localeCompare(b.name));
}

async function scanUserCommands(agent: string): Promise<SlashCommand[]> {
    const dir = getUserCommandsDir(agent);
    if (!dir) {
        return [];
    }
    return scanCommandsDir(dir, 'user');
}

async function scanProjectCommands(agent: string, projectDir?: string): Promise<SlashCommand[]> {
    const dirs = await listProjectCommandDirs(agent, projectDir);
    const commands = await Promise.all(dirs.map(async (dir) => await scanCommandsDir(dir, 'project')));
    return commands.flat();
}

/**
 * List all available slash commands for an agent type.
 *
 * Merge order follows locality precedence: global user → project (project
 * overrides same-name globals). For Cursor v1 both capability slots resolve
 * to `null`, so this returns an empty array until CURS-02 wires real paths.
 */
export async function listSlashCommands(agent: string, projectDir?: string): Promise<SlashCommand[]> {
    const [user, project] = await Promise.all([
        scanUserCommands(agent),
        scanProjectCommands(agent, projectDir),
    ]);

    const allCommands = [...user, ...project];

    const commandMap = new Map<string, SlashCommand>();
    for (const command of allCommands) {
        if (commandMap.has(command.name)) {
            commandMap.delete(command.name);
        }
        commandMap.set(command.name, command);
    }

    return Array.from(commandMap.values());
}
