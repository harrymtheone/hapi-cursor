/**
 * Unified MCP bridge setup. Spawns the hapi MCP stdio bridge and returns
 * the MCP server config for downstream consumers.
 */

import { startHappyServer } from '@/agent/serverUtils/startHappyServer';
import { getHappyCliCommand } from '@/utils/spawnHappyCLI';
import type { ApiSessionClient } from '@/api/apiSession';

export interface McpServerEntry {
    command: string;
    args: string[];
}

export type McpServersConfig = Record<string, McpServerEntry>;

export interface HapiMcpBridge {
    server: {
        url: string;
        stop: () => void;
    };
    mcpServers: McpServersConfig;
}

export interface HapiMcpBridgeOptions {
    emitTitleSummary?: boolean;
}

export async function buildHapiMcpBridge(
    client: ApiSessionClient,
    options: HapiMcpBridgeOptions = {}
): Promise<HapiMcpBridge> {
    const happyServer = await startHappyServer(client, {
        emitTitleSummary: options.emitTitleSummary
    });
    const bridgeCommand = getHappyCliCommand(['mcp', '--url', happyServer.url]);

    return {
        server: {
            url: happyServer.url,
            stop: happyServer.stop
        },
        mcpServers: {
            hapi: {
                command: bridgeCommand.command,
                args: bridgeCommand.args
            }
        }
    };
}
