export type TabKey = "feed" | "likes" | "messages" | "trainers" | "profile";

export type Gym = {
  id: string;
  name: string;
  city: string;
};

export type FeedProfile = {
  id: string;
  name: string;
  age: number;
  description?: string;
  photos: string[];
  profileBadge?: string | null;
  inGym?: boolean;
  inGymMinutes?: number;
  inGymAt?: string | null;
};

export type Match = {
  id: string;
  unreadCount?: number;
  userAId: string;
  userBId: string;
  userA: { id: string; name: string; photos: string[]; profileBadge?: string | null };
  userB: { id: string; name: string; photos: string[]; profileBadge?: string | null };
  gym?: { id: string; name: string };
  messages?: Message[];
};

export type Message = {
  id: string;
  text: string;
  createdAt: string;
  fromUserId: string;
  readAt?: string | null;
  attachmentUrl?: string | null;
  attachmentMime?: string | null;
  attachmentFilename?: string | null;
  attachmentSize?: number | null;
};
