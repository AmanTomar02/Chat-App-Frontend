import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import EmojiPicker from "emoji-picker-react";

export default function App() {
    const socket = useRef(null);
    const timer = useRef(null);
    const bottomRef = useRef(null);

    const [userName, setUserName] = useState("");
    const [inputName, setInputName] = useState("");
    const [showNamePopup, setShowNamePopup] = useState(true);

    const [messages, setMessages] = useState([]);
    const [text, setText] = useState("");

    const [typers, setTypers] = useState([]);
    const [onlineUsers, setOnlineUsers] = useState([]);

    const [darkMode, setDarkMode] = useState(false);
    const [showEmoji, setShowEmoji] = useState(false);
    const [showUsersPanel, setShowUsersPanel] = useState(false);

    // ------- avatar color helper -------
    const avatarColor = (name) => {
        const colors = [
            "#34d399",
            "#60a5fa",
            "#a78bfa",
            "#f97316",
            "#fb7185",
            "#facc15",
        ];
        const char = name?.[0] || "a";
        const index = char.toLowerCase().charCodeAt(0) % colors.length;
        return colors[index];
    };

    // ------- connect socket (only once) -------
    useEffect(() => {
        const backendUrl =
            import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

        socket.current = io(backendUrl, { transports: ["websocket"] });

        socket.current.on("connect", () => {
            console.log("Connected:", socket.current.id);

            socket.current.on("roomNotice", (text) => {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: Date.now() + Math.random(),
                        sender: "system",
                        text,
                        ts: Date.now(),
                    },
                ]);
            });

            socket.current.on("onlineUsers", (users) => {
                setOnlineUsers(users);
            });

            socket.current.on("chatMessage", (msg) => {
                setMessages((prev) => [...prev, msg]);
            });

            socket.current.on("typing", (name) => {
                setTypers((prev) =>
                    prev.includes(name) ? prev : [...prev, name]
                );
            });

            socket.current.on("stopTyping", (name) => {
                setTypers((prev) => prev.filter((t) => t !== name));
            });

            socket.current.on("messageRead", ({ messageIds }) => {
                // mark my messages as read if others read them
                setMessages((prev) =>
                    prev.map((m) =>
                        messageIds.includes(m.id) && m.sender === userName
                            ? { ...m, status: "read" }
                            : m
                    )
                );
            });
        });

        return () => {
            socket.current.disconnect();
        };
    }, [userName]);

    // ------- auto scroll -------
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    // ------- typing indicator -------
    useEffect(() => {
        if (!userName || !socket.current) return;

        if (text.trim() !== "") {
            socket.current.emit("typing", userName);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => {
                socket.current.emit("stopTyping", userName);
            }, 900);
        } else {
            socket.current.emit("stopTyping", userName);
        }

        return () => clearTimeout(timer.current);
    }, [text, userName]);

    // ------- mark messages as read (basic) -------
    useEffect(() => {
        if (!socket.current || !userName) return;

        const unreadFromOthers = messages
            .filter(
                (m) =>
                    m.sender !== userName &&
                    m.sender !== "system" &&
                    !m.readByMe
            )
            .map((m) => m.id);

        if (unreadFromOthers.length) {
            socket.current.emit("markRead", unreadFromOthers);
            setMessages((prev) =>
                prev.map((m) =>
                    unreadFromOthers.includes(m.id)
                        ? { ...m, readByMe: true }
                        : m
                )
            );
        }
    }, [messages, userName]);

    // ------- helpers -------
    const formatTime = (ts) => {
        const d = new Date(ts);
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        return `${hh}:${mm}`;
    };

    const handleJoin = (e) => {
        e.preventDefault();
        const trimmed = inputName.trim();
        if (!trimmed) return;

        setUserName(trimmed);
        setShowNamePopup(false);

        // slightly delay join so socket is surely connected
        setTimeout(() => {
            socket.current.emit("joinRoom", trimmed);
        }, 200);

        setMessages([
            {
                id: Date.now(),
                sender: "system",
                text: `Welcome ${trimmed}! Start chatting.`,
                ts: Date.now(),
            },
        ]);
    };

    const sendMessage = () => {
        const msgText = text.trim();
        if (!msgText || !userName) return;

        const msg = {
            id: Date.now(),
            sender: userName,
            text: msgText,
            ts: Date.now(),
            status: "delivered",
        };

        setMessages((prev) => [...prev, msg]);
        socket.current.emit("chatMessage", msg);
        setText("");
        setShowEmoji(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const handleEmojiClick = (emojiData) => {
        setText((prev) => prev + emojiData.emoji);
    };

    // ------- theme classes -------
    const appBg = darkMode
        ? "bg-slate-900 text-slate-100"
        : "bg-gradient-to-br from-[#2E7D32] to-[#004D40] text-slate-900";

    const chatBg = darkMode ? "bg-slate-800" : "bg-white";
    const messagesBg = darkMode ? "bg-slate-900" : "bg-zinc-100";
    const headerBg = darkMode
        ? "bg-gradient-to-r from-slate-900 to-slate-800"
        : "bg-gradient-to-r from-green-600 to-emerald-500";
    const myBubble =
        darkMode ? "bg-emerald-600 text-white" : "bg-emerald-500 text-white";
    const otherBubble = darkMode
        ? "bg-slate-700 text-slate-100"
        : "bg-white text-[#303030]";
    const systemText = darkMode ? "text-slate-400" : "text-gray-500";
    const inputBg = darkMode
        ? "backdrop-blur-md bg-white/10"
        : "backdrop-blur-md bg-white/80";

    return (
        <div className={`${appBg} min-h-screen flex items-center justify-center p-3`}>
            {/* MOBILE overlay for users panel */}
            {showUsersPanel && (
                <div
                    className="fixed inset-0 bg-black/40 z-30 lg:hidden"
                    onClick={() => setShowUsersPanel(false)}
                />
            )}

            <div className="flex w-full max-w-6xl lg:gap-4">
                {/* SIDEBAR — desktop always visible, mobile slide-in */}
                <aside
                    className={`fixed inset-y-0 left-0 w-64 z-40 transform transition-transform duration-300
                    ${showUsersPanel ? "translate-x-0" : "-translate-x-full"}
                    lg:static lg:translate-x-0 ${chatBg} shadow-xl lg:rounded-2xl lg:h-[90vh] flex flex-col`}
                >
                    <div
                        className={`${headerBg} text-white px-4 py-3 flex items-center justify-between lg:rounded-t-2xl`}
                    >
                        <span className="font-semibold text-sm">
                            Online Users ({onlineUsers.length})
                        </span>
                        <span className="text-lg">👥</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
                        {onlineUsers.length === 0 && (
                            <div className="text-xs text-gray-400">
                                No one online yet.
                            </div>
                        )}
                        {onlineUsers.map((name, idx) => (
                            <div
                                key={`${name}-${idx}`}
                                className="flex items-center gap-2 p-2 rounded-lg hover:bg-black/5 transition"
                            >
                                <div
                                    className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                                    style={{ backgroundColor: avatarColor(name) }}
                                >
                                    {name[0]?.toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-medium">
                                        {name}
                                    </span>
                                    <span className="text-[10px] text-emerald-500">
                                        online
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </aside>

                {/* MAIN CHAT WINDOW */}
                <main
                    className={`w-full lg:max-w-2xl h-[90vh] ${chatBg} rounded-2xl shadow-xl flex flex-col overflow-hidden mx-auto`}
                >
                    {/* HEADER */}
                    <header
                        className={`${headerBg} text-white px-4 py-3 flex items-center gap-3 shadow-md`}
                    >
                        {/* sidebar toggle on mobile */}
                        <button
                            className="lg:hidden h-9 w-9 rounded-full bg-white/15 flex items-center justify-center text-sm"
                            onClick={() => setShowUsersPanel(true)}
                        >
                            👥
                        </button>

                        <div
                            className="h-10 w-10 rounded-full flex items-center justify-center font-semibold text-white"
                            style={{
                                backgroundColor: avatarColor(userName || "A"),
                            }}
                        >
                            {userName ? userName[0]?.toUpperCase() : "?"}
                        </div>

                        <div className="flex-1">
                            <div className="text-sm font-semibold">
                                Realtime Group Chat
                            </div>
                            <div className="text-xs text-emerald-100 flex items-center gap-2">
                                {typers.length ? (
                                    <>
                                        <span>{typers.join(", ")} typing</span>
                                        <div className="typing-dots flex items-center">
                                            <span></span>
                                            <span></span>
                                            <span></span>
                                        </div>
                                    </>
                                ) : (
                                    <>Online: {onlineUsers.length}</>
                                )}
                            </div>
                        </div>

                        {/* dark mode toggle */}
                        <button
                            onClick={() => setDarkMode((d) => !d)}
                            className="h-8 w-8 rounded-full bg-white/15 flex items-center justify-center text-xs"
                            title="Toggle theme"
                        >
                            {darkMode ? "☀️" : "🌙"}
                        </button>

                        {userName && (
                            <div className="hidden sm:flex flex-col text-right text-xs">
                                <span className="opacity-80">Signed in as</span>
                                <span className="font-semibold capitalize">
                                    {userName}
                                </span>
                            </div>
                        )}
                    </header>

                    {/* MESSAGES */}
                    <section
                        className={`flex-1 overflow-y-auto px-4 py-3 space-y-3 ${messagesBg} flex flex-col`}
                    >
                        {messages.map((m) => {
                            const mine = m.sender === userName;
                            const isSystem = m.sender === "system";

                            if (isSystem) {
                                return (
                                    <div
                                        key={m.id}
                                        className={`text-center text-[11px] my-2 ${systemText}`}
                                    >
                                        {m.text}
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={m.id}
                                    className={`flex ${
                                        mine ? "justify-end" : "justify-start"
                                    } animate-message`}
                                >
                                    <div className="relative group">
                                        <div
                                            className={`max-w-[78%] px-3 py-2 rounded-xl shadow-sm ${
                                                mine
                                                    ? `${myBubble} rounded-br-none`
                                                    : `${otherBubble} rounded-bl-none`
                                            }`}
                                        >
                                            <div className="whitespace-pre-wrap break-words text-sm">
                                                {m.text}
                                            </div>
                                            <div className="flex justify-between items-center gap-2 mt-1">
                                                {!mine && (
                                                    <div className="text-[10px] opacity-70">
                                                        {m.sender}
                                                    </div>
                                                )}
                                                <div className="flex-1" />
                                                <div className="flex items-center gap-1 text-[10px] opacity-80">
                                                    <span>
                                                        {formatTime(m.ts)}
                                                    </span>
                                                    {mine && (
                                                        <span
                                                            className={
                                                                m.status ===
                                                                "read"
                                                                    ? "text-sky-400"
                                                                    : "text-gray-200"
                                                            }
                                                        >
                                                            ✓✓
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* hover reactions */}
                                        <div className="reaction-hover absolute -top-3 right-2 text-lg">
                                            😀 😍 👍
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={bottomRef} />
                    </section>

                    {/* INPUT AREA */}
                    <footer className="p-3 border-t border-black/5">
                        <div
                            className={`flex items-end gap-2 px-3 py-2 rounded-full shadow-xl border border-white/30 ${inputBg}`}
                        >
                            {/* emoji button */}
                            <div className="relative">
                                <button
                                    className="h-8 w-8 rounded-full flex items-center justify-center text-xl"
                                    onClick={() => setShowEmoji((s) => !s)}
                                >
                                    😀
                                </button>
                                {showEmoji && (
                                    <div className="absolute bottom-10 left-0 z-20 emoji-popup">
                                        <EmojiPicker
                                            onEmojiClick={handleEmojiClick}
                                            theme={darkMode ? "dark" : "light"}
                                            height={320}
                                            width={280}
                                        />
                                    </div>
                                )}
                            </div>

                            <textarea
                                rows={1}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Type a message..."
                                className="flex-1 bg-transparent outline-none resize-none text-sm py-2"
                            />

                            <button
                                onClick={sendMessage}
                                className="send-btn px-4 py-2 bg-emerald-600 text-white text-sm rounded-full hover:bg-emerald-700 transition"
                            >
                                Send
                            </button>
                        </div>
                    </footer>
                </main>
            </div>

            {/* NAME POPUP */}
            {showNamePopup && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl p-7 w-full max-w-sm animate-popup">
                        <h2 className="text-xl font-semibold">Enter your name</h2>
                        <p className="text-gray-500 text-sm mt-1">
                            Start chatting with others in realtime
                        </p>
                        <form onSubmit={handleJoin} className="mt-5 space-y-3">
                            <input
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                placeholder="Your name"
                                value={inputName}
                                onChange={(e) => setInputName(e.target.value)}
                                autoFocus
                            />
                            <button
                                type="submit"
                                className="w-full mt-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                            >
                                Join Chat
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
