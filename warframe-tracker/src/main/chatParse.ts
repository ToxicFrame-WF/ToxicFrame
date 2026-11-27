// Based on ONE observed EE.log line; the format may need adjusting:
// "ChatRedux.lua: ChatRedux::AddTab: Adding tab with channel name: FSomePlayer to index 3"
// Private chats use an "F" prefix; H_, Q_, R_, S..., C... are other channels and are ignored.
export const CHAT_TAB = /ChatRedux::AddTab: Adding tab with channel name: F(\S+) to index/

export function chatPlayerFromLine(line: string): string | null {
  return CHAT_TAB.exec(line)?.[1] ?? null
}
