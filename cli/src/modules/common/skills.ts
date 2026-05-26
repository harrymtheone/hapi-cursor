import { access, readdir, readFile } from 'fs/promises';
import { basename, dirname, join, relative, resolve } from 'path';
import { homedir } from 'os';
import { parse as parseYaml } from 'yaml';
import type { SkillSummary } from '@hapi/protocol/schemas';

export type { SkillSummary } from '@hapi/protocol/schemas';

export interface ListSkillsRequest {
}

async function pathExists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

function getHomeDirectory(): string {
    return process.env.HOME ?? process.env.USERPROFILE ?? homedir();
}

function getUserSkillsRoots(): string[] {
    const home = getHomeDirectory();
    return [
        join(home, '.agents', 'skills'),
        join(home, '.cursor', 'skills'),
    ];
}

function getProjectSkillsRoots(directory: string): string[] {
    return [
        join(directory, '.agents', 'skills'),
        join(directory, '.cursor', 'skills'),
    ];
}

async function findGitRoot(startDirectory: string): Promise<string | null> {
    let currentDirectory = resolve(startDirectory);

    while (true) {
        if (await pathExists(join(currentDirectory, '.git'))) {
            return currentDirectory;
        }

        const parentDirectory = dirname(currentDirectory);
        if (parentDirectory === currentDirectory) {
            return null;
        }

        currentDirectory = parentDirectory;
    }
}

async function listProjectSkillsRoots(workingDirectory?: string): Promise<string[]> {
    if (!workingDirectory) {
        return [];
    }

    const resolvedWorkingDirectory = resolve(workingDirectory);
    const directories = [resolvedWorkingDirectory];
    let currentDirectory = resolvedWorkingDirectory;

    while (true) {
        if (await pathExists(join(currentDirectory, '.git'))) {
            return directories.flatMap(getProjectSkillsRoots);
        }

        const parentDirectory = dirname(currentDirectory);
        if (parentDirectory === currentDirectory) {
            return getProjectSkillsRoots(resolvedWorkingDirectory);
        }

        currentDirectory = parentDirectory;
        directories.push(currentDirectory);
    }
}

function parseFrontmatter(fileContent: string): {
    frontmatter?: Record<string, unknown>;
    body: string;
    frontmatterError?: string;
} {
    const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) {
        return { body: fileContent.trim() };
    }

    const yamlContent = match[1];
    const body = match[2].trim();
    try {
        const parsed = parseYaml(yamlContent) as Record<string, unknown> | null;
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return { body, frontmatterError: 'Frontmatter must be a YAML object' };
        }

        return { frontmatter: parsed, body };
    } catch (error) {
        return {
            body,
            frontmatterError: error instanceof Error ? error.message : 'Invalid YAML frontmatter',
        };
    }
}

function buildPathHint(
    skillMdPath: string,
    source: SkillSummary['source'],
    context: { home: string; gitRoot: string | null; anchorDirectory: string }
): string {
    const normalizedPath = resolve(skillMdPath);

    if (source === 'user') {
        const home = resolve(context.home);
        if (normalizedPath === home || normalizedPath.startsWith(`${home}/`)) {
            return `~${normalizedPath.slice(home.length)}`;
        }

        return normalizedPath.replace(context.home, '~');
    }

    const base = context.gitRoot ?? context.anchorDirectory;
    return relative(resolve(base), normalizedPath);
}

function readInvocationMode(frontmatter?: Record<string, unknown>): SkillSummary['invocationMode'] | undefined {
    if (frontmatter?.['disable-model-invocation'] === true) {
        return 'manual';
    }

    const raw = frontmatter?.invocationMode;
    if (raw === 'auto' || raw === 'manual') {
        return raw;
    }

    return undefined;
}

function extractSkillSummary(
    skillMdPath: string,
    fileContent: string,
    source: SkillSummary['source'],
    context: { home: string; gitRoot: string | null; anchorDirectory: string }
): SkillSummary {
    const skillDir = dirname(skillMdPath);
    const nameFallback = basename(skillDir);
    const pathHint = buildPathHint(skillMdPath, source, context);
    const parsed = parseFrontmatter(fileContent);

    if (parsed.frontmatterError) {
        const nameFromFrontmatter = typeof parsed.frontmatter?.name === 'string'
            ? parsed.frontmatter.name.trim()
            : '';
        const name = nameFromFrontmatter || nameFallback;

        return {
            name,
            source,
            valid: false,
            invalidReason: parsed.frontmatterError,
            pathHint,
        };
    }

    const nameFromFrontmatter = typeof parsed.frontmatter?.name === 'string'
        ? parsed.frontmatter.name.trim()
        : '';
    const name = nameFromFrontmatter || nameFallback;

    const description = typeof parsed.frontmatter?.description === 'string'
        ? parsed.frontmatter.description.trim()
        : undefined;

    const invocationMode = readInvocationMode(parsed.frontmatter);

    return {
        name,
        description,
        source,
        invocationMode,
        valid: true,
        pathHint,
    };
}

async function collectSkillMdFiles(skillsRoot: string): Promise<string[]> {
    const result: string[] = [];

    async function walk(directory: string): Promise<void> {
        let entries;
        try {
            entries = await readdir(directory, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            if (entry.name.startsWith('.')) {
                continue;
            }

            const entryPath = join(directory, entry.name);
            if (entry.isDirectory()) {
                await walk(entryPath);
                continue;
            }

            if (entry.isFile() && entry.name === 'SKILL.md') {
                result.push(entryPath);
            }
        }
    }

    await walk(skillsRoot);
    return result;
}

async function readSkillsFromRoot(
    skillsRoot: string,
    source: SkillSummary['source'],
    context: { home: string; gitRoot: string | null; anchorDirectory: string }
): Promise<SkillSummary[]> {
    if (!(await pathExists(skillsRoot))) {
        return [];
    }

    const skillMdPaths = await collectSkillMdFiles(skillsRoot);
    const skills = await Promise.all(skillMdPaths.map(async (skillMdPath) => {
        try {
            const fileContent = await readFile(skillMdPath, 'utf-8');
            return extractSkillSummary(skillMdPath, fileContent, source, context);
        } catch {
            return null;
        }
    }));

    return skills.filter((skill): skill is SkillSummary => skill !== null);
}

export async function listSkills(workingDirectory?: string): Promise<SkillSummary[]> {
    const home = getHomeDirectory();
    const resolvedWorkingDirectory = workingDirectory ? resolve(workingDirectory) : undefined;
    const gitRoot = resolvedWorkingDirectory ? await findGitRoot(resolvedWorkingDirectory) : null;
    const projectRoots = [...new Set(await listProjectSkillsRoots(resolvedWorkingDirectory))];
    const userRoots = getUserSkillsRoots();

    const projectContext = {
        home,
        gitRoot,
        anchorDirectory: resolvedWorkingDirectory ?? gitRoot ?? home,
    };

    const userContext = {
        home,
        gitRoot: null,
        anchorDirectory: home,
    };

    const [projectSkillsByRoot, userSkillsByRoot] = await Promise.all([
        Promise.all(projectRoots.map((root) => readSkillsFromRoot(root, 'project', projectContext))),
        Promise.all(userRoots.map((root) => readSkillsFromRoot(root, 'user', userContext))),
    ]);

    const projectSkills = projectSkillsByRoot.flat();
    const userSkills = userSkillsByRoot.flat();

    const dedupedSkills = new Map<string, SkillSummary>();
    for (const skill of [
        ...projectSkills,
        ...userSkills,
    ]) {
        if (!dedupedSkills.has(skill.name)) {
            dedupedSkills.set(skill.name, skill);
        }
    }

    return [...dedupedSkills.values()].sort((a, b) => a.name.localeCompare(b.name));
}
