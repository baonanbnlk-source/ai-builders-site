export type Category =
  | "frontier-labs"
  | "ai-coding"
  | "founder-product"
  | "investor"
  | "media"
  | "official";

export interface CategoryMeta {
  id: Category;
  label: string;
  color: string; // tailwind bg class
  textColor: string;
  description: string;
}

export interface Builder {
  handle: string;
  name: string;
  displayName: string;
  category: Category;
  bio: string; // short bio
  focus: string; // 关注方向
  aliases: string[]; // 中文搜索别名
  avatarSeed: string;
  xUrl: string;
}

export interface Tweet {
  id: string;
  text: string;
  url: string;
  createdAt: string; // ISO
  likes: number;
  retweets: number;
  replies: number;
  isQuote: boolean;
  quotedTweetId: string | null;
  handle: string;
  authorName?: string;
  authorBio?: string;
}

export interface DailyDigest {
  date: string; // YYYY-MM-DD
  tweets: Tweet[];
}

export interface Annotation {
  id: string;
  targetPath: string;
  blockId: string;
  quote: string;
  authorId: string;
  createdAt: number;
  comments: Comment[];
}

export interface Comment {
  id: string;
  authorId: string;
  parentId?: string;
  body: string;
  createdAt: number;
  reactions: { emoji: string; userIds: string[] }[];
}

export interface FakeUser {
  id: string;
  name: string;
  emoji: string;
  color: string;
  underlineColor: string;
  bgColor: string;
}
