import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAnnotations, useCurrentUserId } from "@/lib/storage";
import { getUserById, FAKE_USERS } from "@/data/users";
import { relativeTime } from "@/lib/format";
import type { Annotation } from "@/data/types";

type Tab = "mine" | "replies" | "involved";

export default function Discussions() {
  const all = useAnnotations();
  const [currentUserId] = useCurrentUserId();
  const [tab, setTab] = useState<Tab>("mine");

  const mine = useMemo(() => all.filter((a) => a.authorId === currentUserId), [all, currentUserId]);
  const replies = useMemo(
    () =>
      all.filter(
        (a) => a.authorId === currentUserId && a.comments.some((c) => c.authorId !== currentUserId)
      ),
    [all, currentUserId]
  );
  const involved = useMemo(
    () =>
      all.filter(
        (a) =>
          a.authorId === currentUserId ||
          a.comments.some((c) => c.authorId === currentUserId)
      ),
    [all, currentUserId]
  );

  const data = tab === "mine" ? mine : tab === "replies" ? replies : involved;

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">讨论中心</h1>
        <p className="mt-1 text-sm text-slate-500">
          当前体验账号：<span className="font-medium">{getUserById(currentUserId).emoji} {getUserById(currentUserId).name}</span>
          ，切换右上角账号即可查看不同视角的讨论。
        </p>
        <nav className="mt-4 inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm shadow-sm">
          <TabBtn active={tab === "mine"} onClick={() => setTab("mine")}>我标注的 ({mine.length})</TabBtn>
          <TabBtn active={tab === "replies"} onClick={() => setTab("replies")}>回我的 ({replies.length})</TabBtn>
          <TabBtn active={tab === "involved"} onClick={() => setTab("involved")}>我参与的 ({involved.length})</TabBtn>
        </nav>
      </header>

      <section className="space-y-3">
        {data.length === 0 ? (
          <Empty tab={tab} />
        ) : (
          data.map((a) => <DiscussionCard key={a.id} ann={a} currentUserId={currentUserId} />)
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800">协作者</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {FAKE_USERS.map((u) => (
            <span key={u.id} className={`inline-flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1 text-xs ${u.color}`}>
              <span>{u.emoji}</span> {u.name} {u.id === currentUserId && <span className="text-emerald-500">·当前</span>}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 transition ${
        active ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function Empty({ tab }: { tab: Tab }) {
  const tip =
    tab === "mine"
      ? "你还没有标注过任何段落。试着到「今日简报」选中一句话开始吧。"
      : tab === "replies"
      ? "暂时没有别人回复你。切换右上角到其他账号，给自己回一条试试 😄"
      : "你还没参与过讨论。先到任意页面划线评论吧。";
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
      {tip}
    </div>
  );
}

function DiscussionCard({ ann, currentUserId }: { ann: Annotation; currentUserId: string }) {
  const author = getUserById(ann.authorId);
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>{author.emoji}</span>
        <span className={`font-medium ${author.color}`}>{author.name}</span>
        <span className="text-slate-400">· {relativeTime(ann.createdAt)} ·</span>
        <Link to={ann.targetPath} className="text-indigo-600 hover:text-indigo-700">{ann.targetPath}</Link>
      </div>
      <div
        className="mt-2 rounded-lg px-3 py-2 text-[13px] text-slate-700"
        style={{ backgroundColor: author.bgColor }}
      >
        「{ann.quote}」
      </div>
      <div className="mt-3 space-y-2">
        {ann.comments.length === 0 ? (
          <div className="text-xs text-slate-400">仅标注，无评论。</div>
        ) : (
          ann.comments.map((c) => {
            const u = getUserById(c.authorId);
            return (
              <div key={c.id} className="rounded-xl bg-slate-50 px-3 py-2">
                <div className="flex items-center gap-2 text-xs">
                  <span>{u.emoji}</span>
                  <span className={`font-medium ${u.color}`}>{u.name}</span>
                  <span className="text-slate-400">· {relativeTime(c.createdAt)}</span>
                  {u.id !== currentUserId && c.authorId !== ann.authorId && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-600">回复 @{getUserById(ann.authorId).name}</span>
                  )}
                </div>
                <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{c.body}</div>
              </div>
            );
          })
        )}
      </div>
      <div className="mt-3 text-right">
        <Link to={ann.targetPath} className="text-xs text-indigo-600 hover:text-indigo-700">
          回到原始简报段落 →
        </Link>
      </div>
    </article>
  );
}
