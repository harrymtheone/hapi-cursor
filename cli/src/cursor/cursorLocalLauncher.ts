import { logger } from '@/ui/logger';
import { cursorLocal } from './cursorLocal';
import { CursorSession } from './session';
import { BaseLocalLauncher } from '@/modules/common/launcher/BaseLocalLauncher';
import { permissionModeToCursorArgs } from '@/agent/modeConfig';

export async function cursorLocalLauncher(session: CursorSession): Promise<'switch' | 'exit'> {
    const resumeChatId = session.sessionId;
    if (resumeChatId) {
        session.onSessionFound(resumeChatId);
    }
    const { mode, yolo } = permissionModeToCursorArgs(session.getPermissionMode());

    const launcher = new BaseLocalLauncher({
        label: 'cursor-local',
        failureLabel: 'Local Cursor Agent process failed',
        queue: session.queue,
        rpcHandlerManager: session.client.rpcHandlerManager,
        startedBy: session.startedBy,
        startingMode: session.startingMode,
        launch: async (abortSignal) => {
            await cursorLocal({
                path: session.path,
                chatId: resumeChatId,
                abort: abortSignal,
                cursorArgs: session.cursorArgs,
                model: session.model,
                mode,
                yolo,
                onChatFound: (chatId) => session.onSessionFound(chatId)
            });
        },
        sendFailureMessage: (message) => {
            session.sendSessionEvent({ type: 'message', message });
        },
        recordLocalLaunchFailure: (message, exitReason) => {
            session.recordLocalLaunchFailure(message, exitReason);
        },
        abortLogMessage: 'doAbort',
        switchLogMessage: 'doSwitch'
    });

    const result = await launcher.run();
    return result === 'exit' ? 'exit' : 'switch';
}
