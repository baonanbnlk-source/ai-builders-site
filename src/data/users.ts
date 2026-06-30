// Legacy compat: re-export real user store. The fake-user list now becomes
// an empty placeholder; the source of truth is /api/users.
import type { FakeUser } from "@/data/types";
import { allUsers, getUserById as getById, subscribeUsers } from "@/lib/userStore";

export const FAKE_USERS: FakeUser[] = [];

export function getUserById(id: string): FakeUser {
  const u = getById(id);
  return {
    id: u.id,
    name: u.name,
    emoji: u.emoji,
    color: u.color,
    underlineColor: u.underlineColor,
    bgColor: u.bgColor,
  };
}

export function getAllUsers(): FakeUser[] {
  return allUsers().map((u) => ({
    id: u.id,
    name: u.name,
    emoji: u.emoji,
    color: u.color,
    underlineColor: u.underlineColor,
    bgColor: u.bgColor,
  }));
}

export { subscribeUsers };
