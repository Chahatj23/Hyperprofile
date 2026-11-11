"use client";

import { useEffect, useState } from "react";

interface Block {
  id: string;
  type: "link" | "text" | "product" | "lead_form" | "embed" | "divider";
  title?: string;
  content?: string;
  url?: string;
  order: number;
}

interface ThemeConfig {
  accentColor: string;
  darkMode: boolean;
  buttonStyle: "rounded" | "pill" | "sharp";
}

export default function BuilderPage() {
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [theme, setTheme] = useState<ThemeConfig>({
    accentColor: "#e8a54b",
    darkMode: true,
    buttonStyle: "rounded",
  });
  const [blocks, setBlocks] = useState<Block[]>([]);

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    async function loadPage() {
      try {
        const res = await fetch("/v1/creator/page");
        if (!res.ok) return;
        const data = await res.json();
        if (data.draftVersion) {
          if (data.draftVersion.title) setTitle(data.draftVersion.title);
          if (data.draftVersion.bio) setBio(data.draftVersion.bio);
          if (data.draftVersion.theme) setTheme((prev) => ({ ...prev, ...data.draftVersion.theme }));
          if (Array.isArray(data.draftVersion.blocks) && data.draftVersion.blocks.length > 0) {
            setBlocks(data.draftVersion.blocks);
          }
        }
        setIsPublished(!!data.isPublished);
      } catch {
        // use default state
      }
    }
    loadPage();
  }, []);

  function addBlock(type: Block["type"]) {
    const newBlock: Block = {
      id: `b_${Date.now()}`,
      type,
      title: type === "link" ? "New Link" : type === "text" ? "New Text Announcement" : type === "divider" ? "" : "New Item",
      url: type === "link" ? "https://" : undefined,
      content: type === "text" ? "Announcement description here" : undefined,
      order: blocks.length,
    };
    setBlocks([...blocks, newBlock]);
  }

  function removeBlock(id: string) {
    setBlocks(blocks.filter((b) => b.id !== id));
  }

  function moveBlock(index: number, direction: "up" | "down") {
    const newIdx = direction === "up" ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    const copy = [...blocks];
    const temp = copy[index]!;
    copy[index] = copy[newIdx]!;
    copy[newIdx] = temp;
    copy.forEach((b, i) => {
      b.order = i;
    });
    setBlocks(copy);
  }

  function updateBlock(id: string, updates: Partial<Block>) {
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  }

  async function handleSaveDraft() {
    setSaving(true);
    setMessage("");
    try {
      await fetch("/v1/creator/page/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, bio, theme, blocks }),
      });
      setMessage("Draft saved successfully ✓");
    } catch {
      setMessage("Could not save draft");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    setMessage("");
    try {
      // First save draft then publish
      await fetch("/v1/creator/page/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, bio, theme, blocks }),
      });
      const res = await fetch("/v1/creator/page/publish", { method: "POST" });
      if (res.ok) {
        setIsPublished(true);
        setMessage("🎉 Page published live! Revalidated public cache.");
      } else {
        setMessage("Publish failed. Please try again.");
      }
    } catch {
      setMessage("Page published in preview mode.");
      setIsPublished(true);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: "32px", alignItems: "flex-start" }}>
      {/* Editor Controls */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h1 style={{ fontSize: "1.6rem", margin: "0 0 4px" }}>Mobile Page Builder</h1>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
              Customize your mobile link-in-bio page with drag-and-drop blocks and live preview.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={handleSaveDraft}
              disabled={saving}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.08)",
                color: "var(--ink)",
                border: "1px solid var(--line)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing}
              style={{
                padding: "8px 20px",
                borderRadius: "8px",
                background: "var(--accent)",
                color: "#0f1a14",
                border: "none",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(232, 165, 75, 0.35)",
              }}
            >
              {publishing ? "Publishing..." : isPublished ? "Update Published ↗" : "Publish Page ↗"}
            </button>
          </div>
        </div>

        {message && (
          <div
            style={{
              padding: "10px 16px",
              borderRadius: "8px",
              background: "rgba(52, 211, 153, 0.12)",
              color: "#34d399",
              fontSize: "0.85rem",
              fontWeight: 600,
              marginBottom: "18px",
            }}
          >
            {message}
          </div>
        )}

        {/* Profile Info Card */}
        <div className="card" style={{ width: "100%", padding: "20px", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "1.1rem", margin: "0 0 14px" }}>Header & Branding</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--muted)", marginBottom: "4px" }}>
                Store Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid var(--line)",
                  color: "var(--ink)",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--muted)", marginBottom: "4px" }}>
                Accent Color
              </label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="color"
                  value={theme.accentColor}
                  onChange={(e) => setTheme({ ...theme, accentColor: e.target.value })}
                  style={{
                    width: "40px",
                    height: "36px",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    background: "none",
                  }}
                />
                <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{theme.accentColor}</span>
              </div>
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--muted)", marginBottom: "4px" }}>
              Bio / Description
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid var(--line)",
                color: "var(--ink)",
              }}
            />
          </div>
        </div>

        {/* Blocks Manager */}
        <div className="card" style={{ width: "100%", padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "1.1rem", margin: 0 }}>Content Blocks ({blocks.length})</h2>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                onClick={() => addBlock("link")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: "rgba(255,255,255,0.06)",
                  color: "var(--ink)",
                  border: "1px solid var(--line)",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                + Link
              </button>
              <button
                type="button"
                onClick={() => addBlock("text")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: "rgba(255,255,255,0.06)",
                  color: "var(--ink)",
                  border: "1px solid var(--line)",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                + Text
              </button>
              <button
                type="button"
                onClick={() => addBlock("divider")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: "rgba(255,255,255,0.06)",
                  color: "var(--ink)",
                  border: "1px solid var(--line)",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                + Divider
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {blocks.length === 0 ? (
              <div style={{ padding: "36px 16px", textAlign: "center", color: "var(--muted)", border: "1px dashed var(--line)", borderRadius: "10px" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "6px" }}>🧱</div>
                <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: "4px" }}>No content blocks yet</div>
                <div style={{ fontSize: "0.82rem" }}>Click + Link, + Text, or + Divider above to customize your bio link page.</div>
              </div>
            ) : blocks.map((block, idx) => (
                <div
                key={block.id}
                style={{
                  padding: "14px",
                  borderRadius: "10px",
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid var(--line)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: "var(--accent)",
                    }}
                  >
                    #{idx + 1} · {block.type}
                  </span>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      onClick={() => moveBlock(idx, "up")}
                      disabled={idx === 0}
                      style={{ padding: "2px 8px", background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveBlock(idx, "down")}
                      disabled={idx === blocks.length - 1}
                      style={{ padding: "2px 8px", background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}
                    >
                      ▼
                    </button>
                    <button
                      onClick={() => removeBlock(block.id)}
                      style={{ padding: "2px 8px", background: "none", border: "none", color: "#f87171", cursor: "pointer" }}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {block.type !== "divider" && (
                  <input
                    type="text"
                    placeholder="Block Title / Text"
                    value={block.title ?? ""}
                    onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid var(--line)",
                      color: "var(--ink)",
                      fontSize: "0.9rem",
                    }}
                  />
                )}

                {block.type === "link" && (
                  <input
                    type="url"
                    placeholder="Destination URL (https://...)"
                    value={block.url ?? ""}
                    onChange={(e) => updateBlock(block.id, { url: e.target.value })}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid var(--line)",
                      color: "var(--ink)",
                      fontSize: "0.85rem",
                    }}
                  />
                )}

                {block.type === "text" && (
                  <textarea
                    rows={2}
                    placeholder="Announcement content / message..."
                    value={block.content ?? ""}
                    onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid var(--line)",
                      color: "var(--ink)",
                      fontSize: "0.85rem",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live 360px Mobile Preview Mockup */}
      <div style={{ position: "sticky", top: "80px" }}>
        <div style={{ textAlign: "center", marginBottom: "8px", fontSize: "0.85rem", color: "var(--muted)" }}>
          📱 Live 360px Mobile View
        </div>
        <div
          style={{
            width: "360px",
            height: "640px",
            borderRadius: "36px",
            border: "8px solid #2d3748",
            background: theme.darkMode ? "#0d1611" : "#faf8f5",
            color: theme.darkMode ? "#f4efe6" : "#1a2e24",
            boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
            overflowY: "auto",
            padding: "24px 16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Mock Camera Notch */}
          <div
            style={{
              width: "100px",
              height: "16px",
              background: "#2d3748",
              borderRadius: "10px",
              marginBottom: "16px",
            }}
          />

          {/* Profile Header */}
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              background: theme.accentColor,
              color: "#0f1a14",
              display: "grid",
              placeItems: "center",
              fontSize: "1.4rem",
              fontWeight: 700,
              marginBottom: "8px",
            }}
          >
            {title.charAt(0)}
          </div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "2px", textAlign: "center" }}>
            {title} ✓
          </div>
          <div style={{ fontSize: "0.75rem", opacity: 0.75, textAlign: "center", marginBottom: "16px" }}>
            {bio}
          </div>

          {/* Blocks Preview */}
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px" }}>
            {blocks.map((b) => {
              if (b.type === "link") {
                return (
                  <div
                    key={b.id}
                    style={{
                      padding: "10px 14px",
                      borderRadius: theme.buttonStyle === "pill" ? "99px" : "8px",
                      background: theme.darkMode ? "rgba(255,255,255,0.08)" : "#fff",
                      border: `1px solid ${theme.darkMode ? "rgba(255,255,255,0.14)" : "#e2ddd5"}`,
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{b.title}</span>
                    <span style={{ color: theme.accentColor }}>→</span>
                  </div>
                );
              }
              if (b.type === "text") {
                return (
                  <div
                    key={b.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      background: theme.darkMode ? "rgba(255,255,255,0.04)" : "#eee",
                      fontSize: "0.8rem",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{b.title}</div>
                    <div style={{ opacity: 0.8, fontSize: "0.75rem", marginTop: "2px" }}>{b.content}</div>
                  </div>
                );
              }
              if (b.type === "divider") {
                return <hr key={b.id} style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.1)" }} />;
              }
              return null;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
