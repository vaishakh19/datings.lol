import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  LifeBuoy,
  Plus,
  MessageCircle,
  ChevronLeft,
  Send,
} from "lucide-react";

type Ticket = {
  id: string;
  ticket_number: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
};

type Message = {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
};

interface SupportTabProps {
  userId: string;
}

const categories = [
  "Account & Login",
  "Coach / AI",
  "Technical Problem",
  "Billing & Subscription",
  "Safety / Report",
  "Bug",
  "Other",
];

export const SupportTab: React.FC<SupportTabProps> = ({ userId }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  const [category, setCategory] = useState(categories[0]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTickets();
  }, [userId]);

  async function loadTickets() {
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error) {
      setTickets(data || []);
    }
  }

  async function createTicket() {
    if (!subject.trim() || !description.trim()) {
      alert("Please enter a subject and description.");
      return;
    }

    setLoading(true);

    const ticketNumber = `TKT-${Date.now().toString().slice(-8)}`;

    const { data, error } = await supabase
      .from("support_tickets")
      .insert({
        user_id: userId,
        ticket_number: ticketNumber,
        category,
        subject: subject.trim(),
        description: description.trim(),
        status: "open",
        priority: "normal",
      })
      .select()
      .single();

    setLoading(false);

    if (error) {
      console.error(error);
      alert("Could not create ticket.");
      return;
    }

    setTickets((prev) => [data, ...prev]);

    setSubject("");
    setDescription("");
    setCategory(categories[0]);
    setShowCreate(false);

    setSelectedTicket(data);
  }

  async function openTicket(ticket: Ticket) {
    setSelectedTicket(ticket);

    const { data, error } = await supabase
      .from("support_messages")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });

    if (!error) {
      setMessages(data || []);
    }
  }

  async function sendReply() {
    if (!reply.trim() || !selectedTicket) return;

    const { data, error } = await supabase
      .from("support_messages")
      .insert({
        ticket_id: selectedTicket.id,
        sender_id: userId,
        message: reply.trim(),
        is_admin: false,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      alert("Could not send message.");
      return;
    }

    setMessages((prev) => [...prev, data]);
    setReply("");
  }

  if (selectedTicket) {
    return (
      <div className="min-h-screen bg-black text-white p-5 pb-24">
        <button
          onClick={() => setSelectedTicket(null)}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6"
        >
          <ChevronLeft size={20} />
          Back to Support
        </button>

        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <div className="text-xs text-gray-500 mb-2">
              {selectedTicket.ticket_number}
            </div>

            <h1 className="text-2xl font-bold">
              {selectedTicket.subject}
            </h1>

            <div className="flex gap-2 mt-3">
              <span className="px-3 py-1 rounded-full bg-white/10 text-xs">
                {selectedTicket.category}
              </span>

              <span className="px-3 py-1 rounded-full bg-white/10 text-xs">
                {selectedTicket.status}
              </span>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-5">
            <p className="text-gray-300 whitespace-pre-wrap">
              {selectedTicket.description}
            </p>
          </div>

          <div className="space-y-3 mb-24">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.is_admin ? "justify-start" : "justify-end"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.is_admin
                      ? "bg-white/10"
                      : "bg-purple-600"
                  }`}
                >
                  <div className="text-xs opacity-60 mb-1">
                    {msg.is_admin ? "Support" : "You"}
                  </div>

                  <div className="whitespace-pre-wrap">
                    {msg.message}
                  </div>
                </div>
              </div>
            ))}

            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-10">
                No replies yet. Our support team will respond here.
              </div>
            )}
          </div>

          {selectedTicket.status !== "resolved" && (
            <div className="fixed bottom-0 left-0 right-0 bg-black/95 border-t border-white/10 p-4">
              <div className="max-w-2xl mx-auto flex gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Write a reply..."
                  className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-3 outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      sendReply();
                    }
                  }}
                />

                <button
                  onClick={sendReply}
                  className="bg-purple-600 hover:bg-purple-500 rounded-xl px-4"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-5 pb-24">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2">
              <LifeBuoy size={24} />
              <h1 className="text-2xl font-bold">
                Help & Support
              </h1>
            </div>

            <p className="text-gray-500 mt-1">
              We're here to help.
            </p>
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 px-4 py-3 rounded-xl"
          >
            <Plus size={18} />
            New Ticket
          </button>
        </div>

        {showCreate && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
            <h2 className="text-lg font-semibold mb-4">
              Create Support Ticket
            </h2>

            <label className="text-sm text-gray-400">
              Category
            </label>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full mt-2 mb-4 bg-black border border-white/10 rounded-xl px-4 py-3"
            >
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>

            <label className="text-sm text-gray-400">
              Subject
            </label>

            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What do you need help with?"
              className="w-full mt-2 mb-4 bg-black border border-white/10 rounded-xl px-4 py-3 outline-none"
            />

            <label className="text-sm text-gray-400">
              Description
            </label>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain your problem..."
              rows={5}
              className="w-full mt-2 mb-4 bg-black border border-white/10 rounded-xl px-4 py-3 outline-none resize-none"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 bg-white/10 rounded-xl py-3"
              >
                Cancel
              </button>

              <button
                onClick={createTicket}
                disabled={loading}
                className="flex-1 bg-purple-600 rounded-xl py-3 disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create Ticket"}
              </button>
            </div>
          </div>
        )}

        <div className="mb-4 flex items-center gap-2">
          <MessageCircle size={18} />
          <h2 className="font-semibold">My Tickets</h2>
        </div>

        {tickets.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <LifeBuoy size={40} className="mx-auto mb-3 opacity-50" />

            <p>No support tickets yet.</p>

            <button
              onClick={() => setShowCreate(true)}
              className="text-purple-400 mt-2"
            >
              Create your first ticket
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => openTicket(ticket)}
                className="w-full text-left bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      {ticket.subject}
                    </div>

                    <div className="text-xs text-gray-500 mt-1">
                      {ticket.ticket_number} • {ticket.category}
                    </div>
                  </div>

                  <span className="text-xs px-2 py-1 rounded-full bg-white/10 h-fit">
                    {ticket.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};