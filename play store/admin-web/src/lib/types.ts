export interface AppItem {
  id: string;
  name: string;
  packageName: string;
  slug?: string;
  shortDescription?: string;
  description: string;
  developer: string;
  categoryId: string;
  iconUrl: string;
  screenshots: string[];
  featured?: boolean;
  published: boolean;
  downloadCount?: number;
  latestVersionId?: string;
  latestVersionName?: string;
  latestVersionCode?: number;
  minAndroidVersion?: number;
  apkSize?: number;
  githubOwner?: string;
  githubRepository?: string;
  website?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface AppVersion {
  id: string;
  appId: string;
  versionName: string;
  versionCode: number;
  releaseTag: string;
  apkUrl: string;
  releaseNotes: string;
  changelog?: string;
  apkStoragePath?: string;
  apkSize: number;
  minAndroidVersion: number;
  published: boolean;
  createdAt?: any;
}

export interface AdminStats {
  totalApps: number;
  publishedApps: number;
  draftApps: number;
  totalDownloads: number;
  totalVersions: number;
}

export interface Category {
  id: string;
  name: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'education', name: 'Education' },
  { id: 'productivity', name: 'Productivity' },
  { id: 'utilities', name: 'Utilities' },
  { id: 'tools', name: 'Tools' },
  { id: 'entertainment', name: 'Entertainment' },
  { id: 'other', name: 'Other' },
];
