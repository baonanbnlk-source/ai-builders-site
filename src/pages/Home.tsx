import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useFeed } from "@/lib/FeedProvider";
import { BUILDERS, findBuilder } from "@/data/builders";
import { useAnnotations, useBuilderVisits } from "@/lib/storage";
import { getUserById } from "@/data/users";
import DigestView from "@/components/DigestView";
import { isoDate } from "@/lib/feed";
import { avatarUrl, formatDate, relativeTime, truncate } from "@/lib/format";
import { Sparkles, TrendingUp, Users, MessageCircle, ChevronRight } from "lucide-react";

const ANN_PATH = "/digest/today";

export default function Home() {
  const { todayTweets, generatedAt, digests, loading } = useFeed();
  const allAnnotations = useAnnotations();
  const visits = useBuilderVisits();

  const todayDate = useMemo(() => isoDate(new Date(generatedAt)), [generatedAt]);
  const activeBuilders = useMemo(() => new Set(todayTweets.map((t) => t.handle)), [todayTweets]);

  // ===== Hot discussions today (annotations created today) =====
  const todayHot = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayAnnotations = allAnnotations.filter((a) => a.createdAt >= startOfDay.getTime());
    return todayAnnotations
      .map((a) => {
        const reactions = a.comments.reduce(
          (s, c) => s + c.reactions.reduce((ss, r) => ss + r.userIds.length, 0),
          0
        );
        return { ann: a, score: a.comments.length + reactions };
      })
      .sort((x, y) => y.score - x.score)
      .slice(0, 5);
  }, [allAnnotations]);

  // ===== Top visited builders (real visit log over last 30 days) =====
  const topVisited = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
    const items = Object.entries(visits)
      .filter(([, v]) => v.lastAt >= cutoff)
      .map(([handle, v]) => ({ handle, count: v.count, lastAt: v.lastAt }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return items;
  }, [visits]);

  if (loading) return <LoadingHero />;

  return (
    <div className="grid grid-cols-12 gap-8">
      <div className="col-span-12 lg:col-span-8 space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-indigo-50/40 to-emerald-50/30 p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-indigo-600 shadow-sm">
              <Sparkles className="h-3 w-3" /> AI Builders Daily Briefing
            </span>
            <span className="text-slate-500">{formatDate(generatedAt)} · 真实抓取自 follow-builders</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Stat
              icon={<TrendingUp className="h-4 w-4" />}
              label="今日 X 动态"
              value={`${todayTweets.length}`}
            />
            <Stat
              icon={<Users className="h-4 w-4" />}
              label="活跃 Builder"
              value={`${activeBuilders.size} / ${BUILDERS.length}`}
            />
            <Stat
              icon={<MessageCircle className="h-4 w-4" />}
              label="本机标注"
              value={`${allAnnotations.length}`}
            />
          </div>
        </section>

        <div>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              今日 AI 行业要闻精选
            </h2>
            <span className="text-xs text-slate-500">
              {todayTweets.length} 条原文 · 智能筛选后聚合到 builder 卡片
            </span>
          </div>
          <DigestView
            date={todayDate}
            tweets={todayTweets}
            isToday
            targetPath={ANN_PATH}
            blockIdPrefix="today"
            showHero={false}
            title="今日 AI 行业要闻精选"
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
          <Link
            to="/digest"
            className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
          >
            查看历史简报中心（共 {digests.length} 天） <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <aside className="col-span-12 space-y-6 lg:col-span-4">
        <SidePanel
          title="🔥 今日热门讨论"
          empty="今天还没有标注，赶紧选段开聊吧～"
        >
          {todayHot.length > 0 && (
            <ul className="space-y-3">
              {todayHot.map(({ ann, score }) => {
                const author = getUserById(ann.authorId);
                const reactions = ann.comments.reduce(
                  (s, c) => s + c.reactions.reduce((ss, r) => ss + r.userIds.length, 0),
                  0
                );
                const targetBuilder = parseBuilderFromPath(ann.targetPath);
                return (
                  <li key={ann.id}>
                    <Link
                      to={{
                        pathname: ann.targetPath,
                        search: `?ann=${ann.id}`,
                        hash: `#${ann.blockId}`,
                      }}
                      className="block rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition hover:border-indigo-200 hover:bg-white"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{author.emoji}</span>
                        <span className={`text-xs font-medium ${author.color}`}>{author.name}</span>
                        <span className="text-[10px] text-slate-400">{relativeTime(ann.createdAt)}</span>
                        <span className="ml-auto text-[10px] text-slate-400">分 {score}</span>
                      </div>
                      <div className="mt-1 line-clamp-2 text-[13px] text-slate-700">
                        「{truncate(ann.quote, 60)}」
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
                        <span>💬 {ann.comments.length}</span>
                        <span>❤️ {reactions}</span>
                        {targetBuilder && <span>· @{targetBuilder}</span>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </SidePanel>

        <SidePanel title="⭐ TOP 关注 Builder（近 30 天访问）">
          {topVisited.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
              暂无访问数据，
              <Link to="/builders" className="text-indigo-600 hover:underline">
                去博主目录看看 →
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {topVisited.map(({ handle, count }, idx) => {
                const b = findBuilder(handle);
                return (
                  <li
                    key={handle}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  >
                    <Link
                      to={`/builders/${handle}`}
                      className="flex items-center gap-2 text-sm text-slate-700 hover:text-indigo-600"
                    >
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-50 text-[10px] font-bold text-amber-600">
                        {idx + 1}
                      </span>
                      {b ? (
                        <img
                          src={avatarUrl(b.avatarSeed, 28)}
                          alt={b.displayName}
                          className="h-6 w-6 rounded-full"
                        />
                      ) : (
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-100 text-[10px] text-slate-500">
                          {handle[0]?.toUpperCase()}
                        </span>
                      )}
                      <span className="font-medium">{b?.displayName ?? handle}</span>
                      <span className="text-xs text-slate-400">@{handle}</span>
                    </Link>
                    <span className="text-xs font-medium text-emerald-600">{count} 次</span>
                  </li>
                );
              })}
            </ul>
          )}
        </SidePanel>

        <SidePanel title="💬 协作小贴士">
          <ul className="space-y-2 text-[13px] leading-relaxed text-slate-600">
            <li>① 在任意正文段落 <b>选中文本</b> 即可弹出标注工具条；</li>
            <li>
              ② 标注后段落会出现{" "}
              <span
                className="rounded px-1"
                style={{
                  backgroundColor: "rgba(79,70,229,0.14)",
                  boxShadow: "inset 0 -2px 0 0 rgba(79,70,229,0.65)",
                }}
              >
                彩色下划线
              </span>
              ，右侧 Drawer 会自动展开；
            </li>
            <li>③ 顶栏右上角可切换 <b>体验账号</b>，用同一浏览器演示协作；</li>
            <li>④ 所有数据存 localStorage，可在「我的」页面清理。</li>
          </ul>
        </SidePanel>
      </aside>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-1 text-xs text-slate-500">
        {icon} {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function SidePanel({
  title,
  children,
  empty,
}: {
  title: string;
  children?: React.ReactNode;
  empty?: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">{title}</h3>
      {children ?? <div className="text-xs text-slate-400">{empty}</div>}
    </section>
  );
}

function LoadingHero() {
  return (
    <div className="grid place-items-center py-32 text-slate-400">
      <div className="animate-pulse text-sm">正在加载 builder feed…</div>
    </div>
  );
}

function parseBuilderFromPath(p: string): string | null {
  const m = p.match(/\/builders\/([^/?#]+)/);
  return m ? m[1] : null;
}
