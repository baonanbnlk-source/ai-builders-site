import { useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/auth";
import { X, Mail, LogIn } from "lucide-react";

export default function LoginDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  // Local submitting state — decoupled from the global auth `loading` so the
  // button only shows "登录中…" during an actual submit (never during boot me()).
  const [submitting, setSubmitting] = useState(false);
  if (!open) return null;
  const submit = async () => {
    if (submitting) return;
    setErr(null);
    setSubmitting(true);
    try {
      await login(email.trim(), name.trim() || undefined);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto py-[5vh] px-4 bg-slate-900/40 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="my-auto w-[420px] max-w-[92vw] rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">登录</h2>
            <p className="mt-1 text-xs text-slate-500">使用公司邮箱即可登录，所有评论与标注会跨设备同步</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <label className="block text-xs font-medium text-slate-600">
            工作邮箱<span className="ml-1 text-rose-500">*</span>
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="yourname@bytedance.net"
              className="w-full rounded-xl border border-slate-200 bg-white px-9 py-2 text-sm focus:border-indigo-300 focus:outline-none"
            />
          </div>

          <label className="mt-2 block text-xs font-medium text-slate-600">
            显示名（可选，首次登录会作为头像名字）
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="如：张三"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none"
          />

          {err && <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>}

          <button
            onClick={submit}
            disabled={submitting || !email}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
          >
            <LogIn className="h-4 w-4" />
            {submitting ? "登录中…" : "登录 / 注册"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
