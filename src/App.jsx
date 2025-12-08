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

    // ---------- CONNECT SOCKET ----------
    useEffect(() => {
        const backendUrl =
            import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

        socket.current = io(backendUrl, {
            transports: ["websocket"],
        });

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
                console.log("Received online users:", users);
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
        });

        return () => {
            socket.current.disconnect();
        };
    }, []);   // FIXED ✔

    // ---------- AUTO SCROLL ----------
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    // ---------- TYPING EFFECT ----------
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

    // ---------- MARK MESSAGES AS READ ----------
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

            // mark locally that I've read them
            setMessages((prev) =>
                prev.map((m) =>
                    unreadFromOthers.includes(m.id)
                        ? { ...m, readByMe: true }
                        : m
                )
            );
        }
    }, [messages, userName]);

    // ---------- HELPERS ----------
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

        // socket.current.emit("joinRoom", trimmed);
        setTimeout(() => {
            socket.current.emit("joinRoom", trimmed);
        }, 150);


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
            status: "delivered", // apne side se delivered maan lo
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

    // ---------- THEME CLASSES ----------
    const isDark = darkMode;

    const appBg = isDark
        ? "bg-slate-900 text-slate-100"
        : "bg-gradient-to-br from-[#2E7D32] to-[#004D40] text-slate-900";

    const chatBg = isDark ? "bg-slate-800" : "bg-white";
    const messagesBg = isDark ? "bg-slate-900" : "bg-gray-100";
    const headerBg = isDark ? "bg-slate-950" : "bg-green-600";

    const myBubble =
        isDark ? "bg-emerald-600 text-white" : "bg-green-500 text-white";
    const otherBubble = isDark
        ? "bg-slate-700 text-slate-100"
        : "bg-white text-gray-800";
    const systemText = isDark ? "text-slate-400" : "text-gray-500";

    const inputBg = isDark ? "bg-slate-700" : "bg-gray-100";

    return (
        <div
            className={`${appBg} min-h-screen flex items-center justify-center p-4 font-inter relative`}
        >
            {/* DARK OVERLAY FOR USERS PANEL ON MOBILE */}
            {showUsersPanel && (
                <div
                    className="fixed inset-0 bg-black/40 z-30 lg:hidden"
                    onClick={() => setShowUsersPanel(false)}
                />
            )}

            {/* SLIDE IN ONLINE USERS SIDEBAR */}
            <div
                className={`fixed inset-y-0 left-0 w-64 z-40 transform transition-transform duration-200 ${showUsersPanel ? "translate-x-0" : "-translate-x-full"
                    } ${chatBg} shadow-xl border-r border-black/10 lg:static lg:translate-x-0 lg:w-64 lg:mr-4 lg:rounded-2xl lg:h-[90vh] lg:flex lg:flex-col hidden lg:block`}
            >
                <div
                    className={`${headerBg} text-white px-4 py-3 flex items-center justify-between lg:rounded-t-2xl`}
                >
                    <span className="font-semibold text-sm">Online users</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 text-sm">
                    {!onlineUsers.length && (
                        <div className="text-xs text-gray-400">
                            No users online yet.
                        </div>
                    )}
                    {onlineUsers.map((name, idx) => (
                        <div
                            key={`${name}-${idx}`}
                            className="flex items-center gap-2 py-1.5"
                        >
                            <div className="h-7 w-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs">
                                {name[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1">
                                <div className="text-xs font-medium">
                                    {name}
                                </div>
                                <div className="text-[10px] text-emerald-500">
                                    online
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* MAIN CHAT WINDOW */}
            <div
                className={`w-full max-w-2xl h-[90vh] ${chatBg} rounded-2xl shadow-xl flex flex-col overflow-hidden animate-slideUp`}
            >
                {/* HEADER */}
                <div
                    className={`${headerBg} text-white px-4 py-3 flex items-center gap-3 shadow-md`}
                >
                    {/* Online users toggle (mobile) */}
                    <button
                        className="lg:hidden h-9 w-9 rounded-full bg-white/15 flex items-center justify-center text-sm"
                        onClick={() => setShowUsersPanel((s) => !s)}
                    >
                        👥
                    </button>

                    <div className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center font-semibold">
                        {userName ? userName[0]?.toUpperCase() : "?"}
                    </div>

                    <div className="flex-1">
                        <div className="font-semibold text-sm">
                            Realtime group chat
                        </div>
                        <div className="text-xs text-emerald-100">
                            {typers.length
                                ? `${typers.join(", ")} typing...`
                                : "Online users: " + onlineUsers.length}
                        </div>
                    </div>

                    {/* Dark mode toggle */}
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
                </div>

                {/* MESSAGES */}
                <div
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
                                className={`flex ${mine ? "justify-end" : "justify-start"
                                    } animate-fadeIn`}
                            >
                                <div
                                    className={`max-w-[78%] px-3 py-2 rounded-xl shadow-sm ${mine
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
                                            <span>{formatTime(m.ts)}</span>
                                            {mine && (
                                                <span
                                                    className={
                                                        m.status === "read"
                                                            ? "text-sky-400"
                                                            : "text-gray-300"
                                                    }
                                                >
                                                    ✓✓
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={bottomRef} />
                </div>

                {/* INPUT AREA */}
                <div className="p-3 border-t border-black/5">
                    <div
                        className={`flex items-end gap-2 px-3 py-2 rounded-full ${inputBg}`}
                    >
                        {/* Emoji button */}
                        <div className="relative">
                            <button
                                className="h-8 w-8 rounded-full flex items-center justify-center text-xl"
                                onClick={() => setShowEmoji((s) => !s)}
                            >
                                😀
                            </button>
                            {showEmoji && (
                                <div className="absolute bottom-10 left-0 z-20">
                                    <EmojiPicker
                                        onEmojiClick={handleEmojiClick}
                                        theme={isDark ? "dark" : "light"}
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
                            className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-full hover:bg-emerald-700 transition"
                        >
                            Send
                        </button>
                    </div>
                </div>
            </div>

            {/* NAME POPUP */}
            {showNamePopup && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl p-7 w-full max-w-sm animate-fadeIn">
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
