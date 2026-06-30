import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  useAnnotations,
  useCurrentUserId,
  useFollowedHandles,
} from "@/lib/storage";
import { findBuilder } from "@/data/builders";
import { getUserById } from "@/data/users";
import { avatarUrl } from "@/lib/format";
import { Trash2 } from "lucide-react";

export default function Me() {
  const [currentUserId] = useCurrentUserId();
  const all = useAnnotations();
  const [follows, toggleFollow] = useFollowedHandles();

  const mine = useMemo(() => all.filter((a) => a.authorId === currentUserId), [all, currentUserId]);
  const myComments = useMemo(
    () => all.flatMap((a) => a.comments.filter((c) => c.authorId === currentUserId)),
    [all, currentUserId]
  );

  const user = getUserById(currentUserId);

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className={`grid h-16 w-16 place-items-center rounded-2xl bg-slate-100 text-3xl ${user.color}`}>
            {user.emoji}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{user.name}</h1>
            <p className="text-sm text-slate-500">账号 ID：{user.id} · 标注与评论已同步到服务端，跨设备可见</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <Stat label="关注 Builder" value={follows.length} />
          <Stat label="我的标注" value={mine.length} />
          <Stat label="我的评论" value={myComments.length} />
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-800">我关注的 Builder</h3>
        {follows.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            还没有关注任何 builder，去 <Link to="/builders" className="text-indigo-600">博主目录</Link> 选择几位吧。
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {follows.map((h) => {
              const b = findBuilder(h);
              if (!b) return null;
              return (
                <div key={h} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                  <img src={avatarUrl(b.avatarSeed, 40)} className="h-8 w-8 rounded-full" alt="" />
                  <Link to={`/builders/${b.handle}`} className="flex-1 text-sm font-medium text-slate-700 hover:text-indigo-600">
                    {b.displayName} <span className="text-xs text-slate-400">@{b.handle}</span>
                  </Link>
                  <button
                    onClick={() => toggleFollow(h)}
                    className="text-xs text-slate-400 hover:text-rose-500"
                  >
                    取消
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">本机设置</h3>
          <button
            onClick={() => {
              if (confirm("确定要清空本浏览器所有标注与设置吗？")) {
                localStorage.removeItem("prd_annotations_v1");
                localStorage.removeItem("prd_followed_builders_v1");
                localStorage.removeItem("prd_subscriptions_v1");
                window.dispatchEvent(new Event("annotations:update"));
                window.dispatchEvent(new Event("follow:update"));
                location.reload();
              }
            }}
            className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50"
          >
            <Trash2 className="h-3 w-3" /> 清空本机数据
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">标注、评论与关注已存储在服务端账号下，跨设备同步；此处仅清理本机的本地偏好缓存。</p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
