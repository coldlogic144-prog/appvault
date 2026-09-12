import type { Timestamp } from './user';

export type PostVisibility = 'public' | 'private' | 'friends';
export type ModerationStatus = 'approved' | 'pending' | 'removed';

export interface Post {
  postId: string;
  authorId: string;
  content: string;
  imageURLs: string[];
  visibility: PostVisibility;
  likeCount: number;
  commentCount: number;
  reportCount: number;
  moderationStatus: ModerationStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Comment {
  commentId: string;
  authorId: string;
  content: string;
  deleted: boolean;
  reportCount: number;
  createdAt: Timestamp;
}

export interface PostLike {
  uid: string;
  createdAt: Timestamp;
}

export interface CreatePostRequest {
  content: string;
  visibility: PostVisibility;
  imageURLs?: string[];
}

export interface CreateCommentRequest {
  postId: string;
  content: string;
}
