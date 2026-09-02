"use client";

import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent, type DragEvent } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import {
  Bot,
  User,
  FileText,
  Upload,
  Search,
  Sparkles,
  Database,
  HelpCircle,
  Layers,
  Moon,
  Sun,
  Trash2,
  CheckCircle2,
  Network,
  Plus,
  Menu,
  X,
  Paperclip,
  Copy,
  Check,
  Command,
  ArrowUp,
  BookOpen,
  Scale,
  Code2,
  GitCompare,
  Server,
  BrainCircuit,
  LayoutDashboard,
  ArrowRight,
  DatabaseZap
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ARCHITECTURE_MD } from "@/lib/architecture";

type TabId = "chat" | "search" | "upload" | "architecture";

type Message = {
  id: string;
  role: "user" | "ai";
  content: string;
  sources?: string[];
  isStreaming?: boolean;
};

type SearchResult = {
  content?: string;
  pageContent?: string;
  metadata: {
    documentId?: string;
    source?: string;
    loc?: { lines: { from: number; to: number } };
  };
};

type DocumentItem = { id: string; title: string; isIndexed: boolean; createdAt: string };
type ConversationItem = { id: string; title: string; createdAt: string };

const SUGGESTED_PROMPTS = [
  { text: "Summarize my uploaded documents", icon: BookOpen },
  { text: "What are the key decisions in these files?", icon: Scale },
  { text: "Find implementation details for…", icon: Code2 },
  { text: "Compare the available sources", icon: GitCompare },
];

const NAV_ITEMS: { id: TabId; label: string; hint: string; icon: typeof Sparkles }[] = [
  { id: "chat", label: "Chat", hint: "Ask grounded questions", icon: Sparkles },
  { id: "search", label: "Explorer", hint: "Search the vector index", icon: Search },
  { id: "upload", label: "Knowledge", hint: "Manage source documents", icon: Database },
  { id: "architecture", label: "Architecture", hint: "How the stack fits together", icon: Network },
];

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function parseMessageContent(content: string) {
  let thinkContent = null;
  let finalContent = content;

  const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
  if (thinkMatch) {
    thinkContent = thinkMatch[1].trim();
    finalContent = content.replace(/<think>[\s\S]*?<\/think>/, "").trim();
  } else if (content.includes("<think>")) {
    thinkContent = content.split("<think>")[1].trim();
    finalContent = "";
  }

  return { thinkContent, finalContent };
}

const getApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:4000`;
  }
  return "http://localhost:4000";
};

export default function AppDashboard() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);

  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const goToTab = (tab: TabId) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${getApiBase()}/documents`);
      if (!res.ok) {
        setDocuments([]);
        return;
      }
      const data = await res.json();
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setDocuments([]);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetch(`${getApiBase()}/conversations`)
      .then((res) => res.json())
      .then((data) => setConversations(Array.isArray(data) ? data : []))
      .catch(console.error);

    fetchDocuments();
  }, []);

  useEffect(() => {
    if (activeTab === "chat" && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [chatInput]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMobileMenuOpen(false);
        setHelpOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        goToTab("search");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        startNewChat();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const startNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    goToTab("chat");
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const loadConversation = async (id: string) => {
    setActiveConversationId(id);
    goToTab("chat");
    setIsChatLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/conversations/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.messages) {
        setMessages(
          data.messages.map((m: Message) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            sources: m.sources,
          }))
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load conversation");
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${getApiBase()}/documents/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      toast.success("Document uploaded successfully!", {
        description: "It has been processed and indexed into Qdrant.",
      });
      setFile(null);
      fetchDocuments();
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload document");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      const res = await fetch(`${getApiBase()}/documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Document deleted", { description: "Vectors removed from Qdrant." });
      setSelectedDocumentIds((prev) => prev.filter((docId) => docId !== id));
      fetchDocuments();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete document");
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${getApiBase()}/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Conversation deleted");
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        startNewChat();
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete conversation");
    }
  };

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isSearching) return;

    setIsSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(`${getApiBase()}/chat/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResults(data);
      if (data.length === 0) {
        toast.info("No relevant documents found.");
      } else {
        toast.success(`Found ${data.length} relevant snippets.`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to perform semantic search");
    } finally {
      setIsSearching(false);
    }
  };

  const handleChatSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;
    const input = chatInput.trim();

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    const aiMessageId = Math.random().toString(36).substring(7);

    setMessages((prev) => [...prev, userMsg, { id: aiMessageId, role: "ai", content: "", isStreaming: true }]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      let currentConversationId = activeConversationId;

      if (!currentConversationId) {
        const res = await fetch(`${getApiBase()}/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: input.length > 30 ? input.slice(0, 30) + "..." : input }),
        });
        const newConvo = await res.json();
        currentConversationId = newConvo.id;
        setActiveConversationId(newConvo.id);
        setConversations((prev) => [newConvo, ...prev]);
      }

      const searchParams = new URLSearchParams({
        query: input,
        ...(currentConversationId ? { conversationId: currentConversationId } : {}),
        ...(selectedDocumentIds.length > 0 ? { documentIds: selectedDocumentIds.join(",") } : {}),
      });

      let fullContent = "";
      let extractedSources: string[] = [];

      await fetchEventSource(`${getApiBase()}/chat/stream?${searchParams.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        onmessage(event) {
          if (event.data) {
            let chunkText = event.data;
            try {
              const parsed = JSON.parse(event.data);
              if (parsed.text !== undefined) chunkText = parsed.text;
            } catch (e) {}

            if (chunkText.startsWith("[SOURCES]") && chunkText.endsWith("[/SOURCES]")) {
              const jsonStr = chunkText.replace("[SOURCES]", "").replace("[/SOURCES]", "");
              const parsedSources = JSON.parse(jsonStr);
              extractedSources = parsedSources.sources || [];
              setMessages((prev) =>
                prev.map((msg) => (msg.id === aiMessageId ? { ...msg, sources: extractedSources } : msg))
              );
              return;
            }
            
            fullContent += chunkText;
            setMessages((prev) =>
              prev.map((msg) => (msg.id === aiMessageId ? { ...msg, content: fullContent } : msg))
            );
          }
        },
        onclose() {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === aiMessageId ? { ...msg, isStreaming: false } : msg))
          );
          setIsChatLoading(false);
        },
        onerror(err) {
          console.error("SSE Error:", err);
          setIsChatLoading(false);
          throw err;
        },
      });
    } catch (error) {
      console.error("Failed to fetch stream", error);
      setIsChatLoading(false);
      toast.error("Connection failed");
    }
  };

  const onComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit();
    }
  };

  const copyMessage = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      toast.error("Could not copy");
    }
  };

  const onDropFile = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  };

  const indexedDocs = documents.filter((d) => d.isIndexed);
  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  if (!mounted) return null;

  return (
    <div className="aurora-bg relative flex h-screen w-full overflow-hidden p-0 text-neutral-900 lg:p-3 dark:text-neutral-50">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="aurora-orb absolute -left-24 -top-28 size-[28rem] rounded-full bg-indigo-400/25 blur-3xl dark:bg-indigo-500/20" />
        <div className="aurora-orb absolute -right-16 top-1/4 size-[22rem] rounded-full bg-fuchsia-400/20 blur-3xl [animation-delay:-6s] dark:bg-fuchsia-500/15" />
        <div className="noise-overlay absolute inset-0" />
      </div>

      {isMobileMenuOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 overflow-hidden lg:rounded-[28px] lg:border lg:border-white/50 lg:bg-white/55 lg:shadow-[0_24px_80px_-24px_rgba(76,29,149,0.35)] lg:backdrop-blur-2xl dark:lg:border-white/10 dark:lg:bg-[#12111a]/70 dark:lg:shadow-[0_24px_80px_-20px_rgba(0,0,0,0.65)]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex h-full w-[268px] shrink-0 flex-col border-r border-white/40 bg-white/80 backdrop-blur-xl dark:border-white/[0.06] dark:bg-[#14131c]/90 lg:relative lg:h-auto lg:translate-x-0 lg:rounded-l-[28px] lg:bg-white/40 dark:lg:bg-white/[0.03]",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          "transition-transform duration-300"
        )}
      >
        <div className="flex items-center gap-3 px-4 py-5">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 p-2.5 shadow-lg shadow-indigo-500/30">
            <Layers className="size-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold tracking-tight">RAG Assistant</h1>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Grounded workspace</p>
          </div>
          <button
            aria-label="Close menu"
            onClick={() => setIsMobileMenuOpen(false)}
            className="ml-auto rounded-xl p-1.5 text-neutral-500 hover:bg-black/5 dark:hover:bg-white/5 lg:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <Button
            onClick={startNewChat}
            className="mb-4 h-10 w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500"
          >
            <Plus className="size-4" />
            New chat
          </Button>

          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
            Workspace
          </p>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => goToTab(item.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-all",
                    active
                      ? "bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-white/10 dark:ring-white/10"
                      : "text-neutral-600 hover:bg-white/60 dark:text-neutral-400 dark:hover:bg-white/[0.05]"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-xl",
                      active
                        ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30"
                        : "bg-neutral-100 text-neutral-400 dark:bg-white/5"
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="block truncate text-[11px] text-neutral-400">{item.hint}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mt-5">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
              Recent
            </p>
            {conversations.length === 0 ? (
              <p className="px-2 py-3 text-xs leading-relaxed text-neutral-400">
                Conversations you start will appear here.
              </p>
            ) : (
              <div className="space-y-0.5">
                {conversations.map((c) => (
                  <div key={c.id} className="group relative">
                    <button
                      onClick={() => loadConversation(c.id)}
                      className={cn(
                        "w-full rounded-2xl px-2.5 py-2 pr-10 text-left transition-colors",
                        activeConversationId === c.id
                          ? "bg-white/90 shadow-sm dark:bg-white/10"
                          : "hover:bg-white/50 dark:hover:bg-white/[0.04]"
                      )}
                    >
                      <span className="block truncate text-[13px] font-medium text-neutral-800 dark:text-neutral-200">
                        {c.title}
                      </span>
                      <span className="text-[11px] text-neutral-400">{relativeTime(c.createdAt)}</span>
                    </button>
                    <button
                      onClick={(e) => handleDeleteConversation(e, c.id)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                      title="Delete conversation"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 border-t border-black/[0.04] p-3 dark:border-white/[0.06]">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl px-2 py-2 text-xs font-medium text-neutral-500 hover:bg-white/70 dark:hover:bg-white/5"
          >
            {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <button
            onClick={() => setHelpOpen(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl px-2 py-2 text-xs font-medium text-neutral-500 hover:bg-white/70 dark:hover:bg-white/5"
          >
            <HelpCircle className="size-3.5" />
            Help
          </button>
        </div>
      </aside>

      <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              aria-label="Open menu"
              onClick={() => setIsMobileMenuOpen(true)}
              className="rounded-xl p-2 text-neutral-500 hover:bg-white/60 dark:hover:bg-white/5 lg:hidden"
            >
              <Menu className="size-4" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">
                {activeTab === "chat"
                  ? activeConversation?.title || "New chat"
                  : NAV_ITEMS.find((n) => n.id === activeTab)?.label}
              </p>
              <p className="hidden truncate text-[11px] text-neutral-500 sm:block">
                {activeTab === "chat"
                  ? selectedDocumentIds.length
                    ? `${selectedDocumentIds.length} source${selectedDocumentIds.length === 1 ? "" : "s"} selected`
                    : "Using the full knowledge base"
                  : NAV_ITEMS.find((n) => n.id === activeTab)?.hint}
              </p>
            </div>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full border border-white/70 bg-white/70 px-2.5 py-1 text-[11px] font-medium text-neutral-500 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 sm:inline-flex">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            Live
          </span>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="flex-1 overflow-y-auto p-5 sm:p-8"
              >
                <div className="mx-auto w-full max-w-2xl space-y-8">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight">Knowledge base</h2>
                    <p className="mt-1 text-sm text-neutral-500">
                      Upload documentation so answers stay grounded in your own files.
                    </p>
                  </div>

                  <div className="rounded-[28px] border border-white/70 bg-white/60 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] sm:p-7">
                    <label
                      htmlFor="file-upload"
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={onDropFile}
                      className={cn(
                        "flex h-48 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed transition-colors",
                        isDragging
                          ? "border-indigo-500 bg-indigo-50/80 dark:bg-indigo-500/10"
                          : "border-neutral-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/40 dark:border-white/15 dark:bg-white/[0.03] dark:hover:border-indigo-500/50"
                      )}
                    >
                      <div className="mb-3 rounded-xl border border-neutral-200 bg-white p-2.5 shadow-sm dark:border-white/10 dark:bg-white/5">
                        <Upload className="size-5 text-neutral-500" />
                      </div>
                      {file ? (
                        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{file.name}</p>
                      ) : (
                        <>
                          <p className="text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-semibold">Drop a file</span> or click to browse
                          </p>
                          <p className="mt-1 text-xs text-neutral-400">JSON, YAML, MD, PDF · max 10MB</p>
                        </>
                      )}
                      <input
                        id="file-upload"
                        type="file"
                        className="hidden"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                      />
                    </label>

                    <Button
                      onClick={handleFileUpload}
                      disabled={!file || isUploading}
                      className="mt-4 h-10 w-full rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                      {isUploading ? "Processing vectors…" : "Ingest document"}
                    </Button>
                  </div>

                  <div>
                    <h3 className="mb-3 text-sm font-semibold">
                      Your sources <span className="font-normal text-neutral-400">{documents.length}</span>
                    </h3>
                    {documents.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-500 dark:border-white/10">
                        No documents yet. Upload a file to start grounding answers.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-3.5 py-3 dark:border-white/[0.08] dark:bg-white/[0.03]"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="rounded-lg bg-indigo-50 p-2 dark:bg-indigo-500/10">
                                <FileText className="size-4 text-indigo-600 dark:text-indigo-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{doc.title}</p>
                                <div className="mt-0.5 flex items-center gap-1.5">
                                  {doc.isIndexed ? (
                                    <>
                                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                                      <span className="text-xs text-emerald-600 dark:text-emerald-400">Indexed</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="size-3 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                                      <span className="text-xs text-amber-600 dark:text-amber-400">Processing…</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="text-neutral-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "search" && (
              <motion.div
                key="search"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="flex h-full flex-1 flex-col overflow-hidden"
              >
                <div className="px-5 py-6 sm:px-8">
                  <div className="mx-auto max-w-3xl space-y-4">
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight">Vector explorer</h2>
                      <p className="mt-1 text-sm text-neutral-500">
                        Inspect the passages the assistant retrieves before generating an answer.
                      </p>
                    </div>
                    <form onSubmit={handleSearch} className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                        <Input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search the vector database…"
                          disabled={isSearching}
                          className="h-11 rounded-2xl border-white/70 bg-white/70 pl-10 backdrop-blur dark:border-white/10 dark:bg-white/[0.05]"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={isSearching || !searchQuery.trim()}
                        className="h-11 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-500 hover:to-violet-500"
                      >
                        {isSearching ? "Searching…" : "Search"}
                      </Button>
                    </form>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 sm:p-8">
                  <div className="mx-auto max-w-3xl space-y-3 pb-10">
                    {searchResults.length === 0 && !isSearching && (
                      <div className="flex min-h-[36vh] flex-col items-center justify-center gap-3 text-center text-neutral-400">
                        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
                          <Search className="size-8 text-neutral-400" />
                        </div>
                        <p className="text-sm">Run a query to inspect retrieved chunks.</p>
                      </div>
                    )}
                    {searchResults.map((result, idx) => (
                      <div
                        key={idx}
                        className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.03]"
                      >
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                            {idx + 1}
                          </span>
                          <span className="flex items-center gap-1.5 truncate text-xs text-neutral-500">
                            <FileText className="size-3.5" />
                            {result.metadata.documentId || result.metadata.source || "Unknown source"}
                          </span>
                          {result.metadata.loc && (
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500 dark:bg-white/5">
                              L{result.metadata.loc.lines.from}–{result.metadata.loc.lines.to}
                            </span>
                          )}
                        </div>
                        <div className="prose-chat rounded-xl bg-neutral-50 p-3 dark:bg-black/25">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {result.content || result.pageContent || ""}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "architecture" && (
              <motion.div
                key="architecture"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="flex-1 overflow-y-auto p-5 sm:p-8"
              >
                <div className="mx-auto max-w-5xl">
                  <div className="mb-10 text-center">
                    <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-br from-neutral-900 to-neutral-500 dark:from-white dark:to-neutral-400 bg-clip-text text-transparent">System Architecture</h2>
                    <p className="mt-2 text-sm text-neutral-500 font-medium">Enterprise Retrieval-Augmented Generation (RAG) Pipeline</p>
                  </div>

                  {/* Core Stack Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    {/* Frontend Card */}
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="group relative rounded-[28px] border border-white/70 bg-white/60 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative">
                        <div className="mb-4 inline-flex rounded-xl bg-blue-100 p-3 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                          <LayoutDashboard className="size-6" />
                        </div>
                        <h3 className="text-lg font-bold mb-1">Frontend</h3>
                        <p className="text-xs text-neutral-500 mb-4 leading-relaxed">Next.js App Router providing a dynamic, glassmorphic UI with Server-Sent Events (SSE).</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-md bg-white/80 px-2 py-1 text-[10px] font-semibold shadow-sm dark:bg-black/40">Next.js</span>
                          <span className="rounded-md bg-white/80 px-2 py-1 text-[10px] font-semibold shadow-sm dark:bg-black/40">Tailwind</span>
                          <span className="rounded-md bg-white/80 px-2 py-1 text-[10px] font-semibold shadow-sm dark:bg-black/40">Framer</span>
                        </div>
                      </div>
                    </motion.div>

                    {/* Backend Card */}
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="group relative rounded-[28px] border border-white/70 bg-white/60 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] hover:shadow-lg hover:border-rose-300 dark:hover:border-rose-500/50 transition-all overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative">
                        <div className="mb-4 inline-flex rounded-xl bg-rose-100 p-3 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
                          <Server className="size-6" />
                        </div>
                        <h3 className="text-lg font-bold mb-1">Backend Core</h3>
                        <p className="text-xs text-neutral-500 mb-4 leading-relaxed">NestJS API Gateway handling document chunking, prompt orchestration, and SSE streaming.</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-md bg-white/80 px-2 py-1 text-[10px] font-semibold shadow-sm dark:bg-black/40">NestJS</span>
                          <span className="rounded-md bg-white/80 px-2 py-1 text-[10px] font-semibold shadow-sm dark:bg-black/40">LangChain</span>
                          <span className="rounded-md bg-white/80 px-2 py-1 text-[10px] font-semibold shadow-sm dark:bg-black/40">Node.js</span>
                        </div>
                      </div>
                    </motion.div>

                    {/* Databases Card */}
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="group relative rounded-[28px] border border-white/70 bg-white/60 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] hover:shadow-lg hover:border-emerald-300 dark:hover:border-emerald-500/50 transition-all overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative">
                        <div className="mb-4 inline-flex rounded-xl bg-emerald-100 p-3 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                          <DatabaseZap className="size-6" />
                        </div>
                        <h3 className="text-lg font-bold mb-1">Storage Layer</h3>
                        <p className="text-xs text-neutral-500 mb-4 leading-relaxed">Dual database system for relational metadata and high-dimensional vector similarity search.</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-md bg-white/80 px-2 py-1 text-[10px] font-semibold shadow-sm dark:bg-black/40">PostgreSQL</span>
                          <span className="rounded-md bg-white/80 px-2 py-1 text-[10px] font-semibold shadow-sm dark:bg-black/40">Prisma</span>
                          <span className="rounded-md bg-white/80 px-2 py-1 text-[10px] font-semibold shadow-sm dark:bg-black/40">Qdrant DB</span>
                        </div>
                      </div>
                    </motion.div>

                    {/* AI Engine Card */}
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="group relative rounded-[28px] border border-white/70 bg-white/60 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] hover:shadow-lg hover:border-fuchsia-300 dark:hover:border-fuchsia-500/50 transition-all overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative">
                        <div className="mb-4 inline-flex rounded-xl bg-fuchsia-100 p-3 text-fuchsia-600 dark:bg-fuchsia-500/20 dark:text-fuchsia-400">
                          <BrainCircuit className="size-6" />
                        </div>
                        <h3 className="text-lg font-bold mb-1">AI Inference</h3>
                        <p className="text-xs text-neutral-500 mb-4 leading-relaxed">Hybrid model architecture combining local open-source embeddings with cloud generation.</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-md bg-white/80 px-2 py-1 text-[10px] font-semibold shadow-sm dark:bg-black/40">Ollama</span>
                          <span className="rounded-md bg-white/80 px-2 py-1 text-[10px] font-semibold shadow-sm dark:bg-black/40">nomic-embed</span>
                          <span className="rounded-md bg-white/80 px-2 py-1 text-[10px] font-semibold shadow-sm dark:bg-black/40">Sarvam AI</span>
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {/* Data Flow Diagram Section */}
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                    className="rounded-[32px] border border-white/70 bg-white/40 p-8 shadow-sm backdrop-blur-2xl dark:border-white/10 dark:bg-[#15141c]/60"
                  >
                    <h3 className="text-lg font-bold mb-8 text-center">Interactive Data Pipelines</h3>
                    
                    <div className="flex flex-col gap-12">
                      {/* Ingestion Pipeline */}
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                          <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" /> 
                          Document Ingestion
                        </h4>
                        <div className="flex flex-col md:flex-row items-center gap-3 w-full justify-between bg-black/5 dark:bg-white/5 p-4 rounded-2xl">
                          <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-black/40 shadow-sm flex-1 justify-center border border-black/5 dark:border-white/5">
                            <Upload className="size-4 text-blue-500" /> <span className="text-xs font-semibold">Upload File</span>
                          </div>
                          <ArrowRight className="size-4 text-neutral-300 dark:text-neutral-600 hidden md:block" />
                          <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-black/40 shadow-sm flex-1 justify-center border border-black/5 dark:border-white/5">
                            <Layers className="size-4 text-rose-500" /> <span className="text-xs font-semibold">Text Chunking</span>
                          </div>
                          <ArrowRight className="size-4 text-neutral-300 dark:text-neutral-600 hidden md:block" />
                          <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-black/40 shadow-sm flex-1 justify-center border border-black/5 dark:border-white/5">
                            <BrainCircuit className="size-4 text-fuchsia-500" /> <span className="text-xs font-semibold">Ollama Vectors</span>
                          </div>
                          <ArrowRight className="size-4 text-neutral-300 dark:text-neutral-600 hidden md:block" />
                          <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-black/40 shadow-sm flex-1 justify-center border border-black/5 dark:border-white/5 border-l-4 border-l-emerald-500">
                            <DatabaseZap className="size-4 text-emerald-500" /> <span className="text-xs font-semibold">Qdrant Index</span>
                          </div>
                        </div>
                      </div>

                      {/* Chat Pipeline */}
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                          <div className="size-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse" /> 
                          RAG Query Generation
                        </h4>
                        <div className="flex flex-col md:flex-row items-center gap-3 w-full justify-between bg-black/5 dark:bg-white/5 p-4 rounded-2xl relative">
                          <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white dark:bg-black/40 shadow-sm flex-1 text-center border border-black/5 dark:border-white/5">
                            <Search className="size-5 text-indigo-500" /> 
                            <span className="text-xs font-semibold">1. User Query</span>
                            <span className="text-[9px] text-neutral-400">With Filter Constraints</span>
                          </div>
                          <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white dark:bg-black/40 shadow-sm flex-1 text-center border border-black/5 dark:border-white/5">
                            <DatabaseZap className="size-5 text-emerald-500" /> 
                            <span className="text-xs font-semibold">2. Qdrant Search</span>
                            <span className="text-[9px] text-neutral-400">Top 3 Similar Chunks</span>
                          </div>
                          <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white dark:bg-black/40 shadow-sm flex-1 text-center border border-black/5 dark:border-white/5">
                            <Layers className="size-5 text-rose-500" /> 
                            <span className="text-xs font-semibold">3. Build Prompt</span>
                            <span className="text-[9px] text-neutral-400">Query + History + Chunks</span>
                          </div>
                          <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white dark:bg-black/40 shadow-sm flex-1 text-center border border-black/5 dark:border-white/5 border-l-4 border-l-indigo-500">
                            <BrainCircuit className="size-5 text-indigo-500" /> 
                            <span className="text-xs font-semibold">4. LLM Stream</span>
                            <span className="text-[9px] text-neutral-400">Sarvam 105b via SSE</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Rendered Documentation */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="prose prose-neutral dark:prose-invert max-w-none mt-12 rounded-[32px] border border-white/70 bg-white/40 p-8 md:p-12 shadow-sm backdrop-blur-2xl dark:border-white/10 dark:bg-[#15141c]/60 prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-a:text-indigo-500 prose-code:text-rose-500 prose-pre:bg-black/5 dark:prose-pre:bg-black/50"
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {ARCHITECTURE_MD}
                    </ReactMarkdown>
                  </motion.div>
                </div>
              </motion.div>
            )}

            {activeTab === "chat" && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="flex h-full flex-1 flex-col overflow-hidden"
              >
                <div className="flex-1 overflow-y-auto">
                  <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
                    {messages.length === 0 && (
                      <div className="flex min-h-[52vh] flex-col items-center justify-center gap-7 text-center">
                        <div className="relative">
                          <div className="absolute inset-0 rounded-3xl bg-indigo-400/40 blur-2xl" />
                          <div className="relative rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 p-3.5 shadow-xl shadow-indigo-500/30">
                            <Sparkles className="size-7 text-white" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-3xl font-semibold tracking-tight">What would you like to know?</p>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            Ask a question, compare documents, or explore your knowledge base.
                          </p>
                        </div>
                        <div className="grid w-full max-w-lg gap-2 sm:grid-cols-2">
                          {SUGGESTED_PROMPTS.map((prompt) => {
                            const Icon = prompt.icon;
                            return (
                              <button
                                key={prompt.text}
                                onClick={() => {
                                  setChatInput(prompt.text);
                                  textareaRef.current?.focus();
                                }}
                                className="group rounded-2xl border border-white/70 bg-white/70 px-3.5 py-3.5 text-left text-xs text-neutral-600 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-white/10 dark:bg-white/[0.05] dark:text-neutral-300 dark:hover:border-indigo-500/40"
                              >
                                <Icon className="mb-2 size-4 text-indigo-500 opacity-80" />
                                {prompt.text}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn("flex gap-3", message.role === "user" ? "flex-row-reverse" : "flex-row")}
                      >
                        <Avatar className="size-8 shrink-0">
                          {message.role === "user" ? (
                            <AvatarFallback className="bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                              <User className="size-3.5" />
                            </AvatarFallback>
                          ) : (
                            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                              <Bot className="size-3.5" />
                            </AvatarFallback>
                          )}
                        </Avatar>

                        <div
                          className={cn(
                            "min-w-0 flex-1",
                            message.role === "user" ? "flex flex-col items-end" : "space-y-2"
                          )}
                        >
                          {message.role === "user" ? (
                            <div className="max-w-[85%] rounded-[22px] rounded-tr-md bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-lg shadow-indigo-500/20">
                              {message.content}
                            </div>
                          ) : (
                            <>
                              <div className="prose-chat text-[15px] leading-7 text-neutral-800 dark:text-neutral-200">
                                {message.content ? (
                                  (() => {
                                    const { thinkContent, finalContent } = parseMessageContent(message.content);
                                    return (
                                      <>
                                        {thinkContent !== null && (
                                          <details className="mb-4 group border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden bg-white/50 dark:bg-black/20">
                                            <summary className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-neutral-500 cursor-pointer select-none hover:bg-black/5 dark:hover:bg-white/5 list-none [&::-webkit-details-marker]:hidden">
                                              <BrainCircuit className="size-4" />
                                              <span>Reasoning Process</span>
                                              <span className="ml-auto text-[10px] text-neutral-400 group-open:rotate-180 transition-transform">▼</span>
                                            </summary>
                                            <div className="px-4 py-3 text-[13px] leading-relaxed text-neutral-600 dark:text-neutral-400 bg-black/5 dark:bg-black/40 border-t border-neutral-200 dark:border-white/10 whitespace-pre-wrap">
                                              {thinkContent || "Thinking..."}
                                            </div>
                                          </details>
                                        )}
                                        {finalContent && (
                                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{finalContent}</ReactMarkdown>
                                        )}
                                      </>
                                    );
                                  })()
                                ) : (
                                  <span className="text-sm text-neutral-400">Thinking…</span>
                                )}
                                {message.isStreaming && <span className="streaming-caret" />}
                              </div>
                              {message.content && !message.isStreaming && (
                                <button
                                  type="button"
                                  onClick={() => copyMessage(message.id, message.content)}
                                  className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/5 dark:hover:text-neutral-200"
                                >
                                  {copiedId === message.id ? <Check className="size-3" /> : <Copy className="size-3" />}
                                  {copiedId === message.id ? "Copied" : "Copy"}
                                </button>
                              )}
                              {message.sources && message.sources.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {Array.from(new Set(message.sources)).map((source) => (
                                    <span
                                      key={source}
                                      className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300"
                                    >
                                      <FileText className="size-3" />
                                      {source}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={scrollRef} />
                  </div>
                </div>

                <div className="composer-fade relative px-4 pb-4 pt-10 sm:px-6">
                  <div className="mx-auto w-full max-w-2xl space-y-2.5">
                    {indexedDocs.length > 0 && (
                      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                          Sources
                        </span>
                        {indexedDocs.map((doc) => {
                          const selected = selectedDocumentIds.includes(doc.id);
                          return (
                            <button
                              key={doc.id}
                              type="button"
                              onClick={() =>
                                setSelectedDocumentIds((prev) =>
                                  prev.includes(doc.id) ? prev.filter((id) => id !== doc.id) : [...prev, doc.id]
                                )
                              }
                              className={cn(
                                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium backdrop-blur transition-colors",
                                selected
                                  ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300"
                                  : "border-white/60 bg-white/50 text-neutral-600 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-neutral-400"
                              )}
                            >
                              {selected ? <Check className="size-3" /> : <FileText className="size-3" />}
                              <span className="max-w-[140px] truncate">{doc.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <form
                      onSubmit={handleChatSubmit}
                      className="rounded-[28px] border border-white/80 bg-white/80 p-2 shadow-[0_18px_50px_-20px_rgba(79,70,229,0.45)] backdrop-blur-xl focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-500/10 dark:border-white/10 dark:bg-[#1a1824]/85 dark:focus-within:border-indigo-500/40"
                    >
                      <Textarea
                        ref={textareaRef}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={onComposerKeyDown}
                        placeholder="Ask about your documents…"
                        disabled={isChatLoading}
                        rows={1}
                        className="max-h-40 min-h-[44px] resize-none px-3 py-2.5"
                      />
                      <div className="flex items-center justify-between gap-2 px-1 pb-0.5 pt-1">
                        <button
                          aria-label="Attach document"
                          type="button"
                          onClick={() => goToTab("upload")}
                          className="rounded-xl p-1.5 text-neutral-400 hover:bg-black/5 hover:text-indigo-600 dark:hover:bg-white/5"
                        >
                          <Paperclip className="size-4" />
                        </button>
                        <Button
                          type="submit"
                          disabled={isChatLoading || !chatInput.trim()}
                          className="size-9 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 p-0 text-white shadow-lg shadow-indigo-500/30 hover:from-indigo-500 hover:to-violet-500"
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                      </div>
                    </form>
                    <p className="text-center text-[11px] text-neutral-400">
                      Grounded in your selected sources. Verify important information.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      </div>

      <AnimatePresence>
        {helpOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={() => setHelpOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-[28px] border border-white/20 bg-white/90 p-5 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#16141f]/90"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Help & shortcuts</h2>
                <button
                  aria-label="Close help"
                  onClick={() => setHelpOpen(false)}
                  className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5"
                >
                  <X className="size-4" />
                </button>
              </div>
              <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
                {[
                  ["New chat", "Ctrl / ⌘ + N"],
                  ["Open explorer", "Ctrl / ⌘ + K"],
                  ["Send message", "Enter"],
                  ["New line", "Shift + Enter"],
                  ["Close dialogs", "Esc"],
                ].map(([label, keys]) => (
                  <li key={label} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 dark:bg-white/5">
                    <span>{label}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500">
                      <Command className="size-3" />
                      {keys}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
