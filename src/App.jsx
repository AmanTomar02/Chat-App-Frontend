import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export default function App() {
    const timer = useRef(null);
    const socket = useRef(null);
    const bottomRef = useRef(null);

    const [userName, setUserName] = useState("");
    const [inputName, setInputName] = useState("");
    const [showPopup, setShowPopup] = useState(true);

    const [messages, setMessages] = useState([]);
    const [typers, setTypers] = useState([]);

    const [text, setText] = useState("");

    useEffect(() => {
        socket.current = io(import.meta.env.VITE_BACKEND_URL || "http://localhost:3000", {
            transports: ["websocket"],
        });

        socket.current.on("connect", () => {
            console.log("Connected:", socket.current.id);

            socket.current.on("roomNotice", (name) => {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: Date.now() + Math.random(),
                        text: `${name} joined the chat`,
                        sender: "system",
                        ts: Date.now(),
                    },
                ]);
            });

            socket.current.on("chatMessage", (msg) => {
                setMessages((prev) => [...prev, msg]);
            });

            socket.current.on("typing", (name) => {
                setTypers((prev) => (!prev.includes(name) ? [...prev, name] : prev));
            });

            socket.current.on("stopTyping", (name) => {
                setTypers((prev) => prev.filter((t) => t !== name));
            });
        });

        return () => socket.current.disconnect();
    }, []);

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    useEffect(() => {
        if (!userName) return;

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
    }, [text]);

    function joinChat(e) {
        e.preventDefault();
        if (!inputName.trim()) return;

        setUserName(inputName.trim());
        setShowPopup(false);

        socket.current.emit("joinRoom", inputName.trim());
    }

    function sendMessage() {
        const msgText = text.trim();
        if (!msgText) return;

        const msg = {
            id: Date.now(),
            sender: userName,
            text: msgText,
            ts: Date.now(),
        };

        setMessages((prev) => [...prev, msg]);
        socket.current.emit("chatMessage", msg);
        setText("");
    }

    function handleKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    const time = (ts) => {
        const d = new Date(ts);
        return `${String(d.getHours()).padStart(2, "0")}:${String(
            d.getMinutes()
        ).padStart(2, "0")}`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#2E7D32] to-[#004D40] flex items-center justify-center p-4 font-inter">

            {/* NAME POPUP */}
            {showPopup && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl p-7 w-full max-w-sm animate-fadeIn">
                        <h2 className="text-xl font-semibold">Enter your name</h2>
                        <p className="text-gray-500 text-sm mt-1">Start chatting instantly</p>
                        <form onSubmit={joinChat} className="mt-5">
                            <input
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                placeholder="Your name"
                                value={inputName}
                                onChange={(e) => setInputName(e.target.value)}
                            />
                            <button
                                type="submit"
                                className="w-full mt-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                            >
                                Join Chat
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* CHAT WINDOW */}
            {!showPopup && (
                <div className="w-full max-w-2xl h-[90vh] bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden animate-slideUp">

                    {/* HEADER */}
                    <div className="bg-green-600 text-white px-5 py-4 flex items-center gap-3 shadow-md">
                        <div className="h-10 w-10 bg-white/20 rounded-full flex items-center justify-center font-semibold">
                            {userName[0].toUpperCase()}
                        </div>
                        <div className="flex-1">
                            <div className="font-semibold text-lg">Realtime Group Chat</div>
                            <div className="text-sm text-green-100">
                                {typers.length > 0 ? `${typers.join(", ")} typing...` : "Online"}
                            </div>
                        </div>
                    </div>

                    {/* MESSAGES */}
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-100">

                        {messages.map((msg) => {
                            const mine = msg.sender === userName;

                            if (msg.sender === "system") {
                                return (
                                    <div
                                        key={msg.id}
                                        className="text-center text-xs text-gray-500 my-3"
                                    >
                                        {msg.text}
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={msg.id}
                                    className={`flex ${mine ? "justify-end" : "justify-start"} animate-fadeIn`}
                                >
                                    <div
                                        className={`max-w-[75%] px-4 py-3 rounded-xl shadow-sm ${
                                            mine
                                                ? "bg-green-500 text-white rounded-br-none"
                                                : "bg-white text-gray-800 rounded-bl-none"
                                        }`}
                                    >
                                        <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                                        <div className="text-[10px] text-gray-200 mt-1 text-right">
                                            {time(msg.ts)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        <div ref={bottomRef}></div>
                    </div>

                    {/* INPUT AREA */}
                    <div className="p-4 bg-white shadow-inner">
                        <div className="flex items-center bg-gray-100 rounded-full px-4 py-2">
                            <textarea
                                rows={1}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Type a message..."
                                className="flex-1 bg-transparent outline-none resize-none py-2"
                            />
                            <button
                                onClick={sendMessage}
                                className="ml-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-full transition"
                            >
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
