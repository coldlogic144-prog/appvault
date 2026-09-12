export {};

declare global {
  interface Window {
    comiclink: {
      platform: string;
      version: string;
      window: {
        minimize: () => void;
        maximize: () => void;
        close: () => void;
      };
    };
  }
}
