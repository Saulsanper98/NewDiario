import type {
  AnnouncementSeverity,
  ReleaseNoteCategory,
} from "@/app/generated/prisma/enums";

export interface ReleaseNoteAuthor {
  id: string;
  name: string;
  image: string | null;
}

export interface ReleaseNoteItem {
  id: string;
  title: string;
  version: string | null;
  summary: string | null;
  body: string;
  category: ReleaseNoteCategory;
  coverImage: string | null;
  pinned: boolean;
  isDraft: boolean;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  createdBy: ReleaseNoteAuthor;
  isRead: boolean;
}

export interface AnnouncementAuthor {
  id: string;
  name: string;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  severity: AnnouncementSeverity;
  isActive: boolean;
  dismissible: boolean;
  ctaLabel: string | null;
  ctaUrl: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: AnnouncementAuthor;
  dismissalsCount: number;
}
