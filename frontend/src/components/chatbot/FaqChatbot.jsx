import { useState } from "react";
import { FaComments, FaTimes, FaPaperPlane } from "react-icons/fa";
import { searchFaq } from "../../services/profiles";

export default function FaqChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "bot", text: "Hi! I'm the Studio 8Teen assistant. Ask me about bookings, payments, hours, or photo delivery." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const question = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    setLoading(true);

    try {
      const result = await searchFaq(question);
      setMessages((m) => [...m, { role: "bot", text: result.answer }]);
    } catch {
      setMessages((m) => [...m, { role: "bot", text: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#A98B75] text-white shadow-lg hover:bg-[#8a7260] transition flex items-center justify-center"
        aria-label="Open FAQ chatbot"
      >
        {open ? <FaTimes size={20} /> : <FaComments size={22} />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-[#E8E1DA] flex flex-col overflow-hidden">
          <div className="bg-[#5B4636] text-white px-4 py-3">
            <h3 className="font-semibold">Studio 8Teen FAQ</h3>
            <p className="text-xs text-white/70">Ask about bookings, payments & more</p>
          </div>

          <div className="flex-1 h-72 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`text-sm rounded-xl px-3 py-2 max-w-[90%] ${
                  msg.role === "user"
                    ? "ml-auto bg-[#A98B75] text-white"
                    : "bg-[#F8F6F3] text-gray-700"
                }`}
              >
                {msg.text}
              </div>
            ))}
            {loading && <div className="text-xs text-gray-400">Typing...</div>}
          </div>

          <form onSubmit={send} className="p-3 border-t border-[#E8E1DA] flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#A98B75]"
            />
            <button
              type="submit"
              disabled={loading}
              className="p-2 rounded-xl bg-[#A98B75] text-white hover:bg-[#8a7260] disabled:opacity-50"
            >
              <FaPaperPlane size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
