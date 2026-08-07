import type { Chat } from "../hooks/useChat";
import { Bubble, Composer, Typing } from "../ui/chat";
import { Chip, Header } from "../ui/primitives";
import type { Go } from "./shared";

export function ChatScreen({ go, chat, onSend }: { go: Go; chat: Chat; onSend: (t: string) => void }) {
  return (
    <>
      <Header title="Companion" subtitle="Remembers what you've saved" onBack={() => go("home")} onAvatar={() => go("profile")} />
      <div className="scroll flex-1 px-5 pb-2 space-y-2.5">
        {chat.msgs.map(m => (
          <div key={m.id}>
            <Bubble m={m} />
            {m.chips && (
              <div className="flex flex-wrap gap-2 mt-2.5">
                {m.chips.map(c => <Chip key={c} onClick={() => onSend(c)}>{c}</Chip>)}
              </div>
            )}
          </div>
        ))}
        {chat.typing && <Typing />}
        <div ref={chat.endRef} className="h-2" />
      </div>
      <Composer placeholder="What is on your mind?" onSend={onSend} />
    </>
  );
}
